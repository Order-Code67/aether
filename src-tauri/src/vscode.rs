use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VsCodeInfo {
    pub installed: bool,
    pub path: Option<String>,
}

fn path_ok(p: &Path) -> bool {
    p.is_file()
}

fn is_windows_batch(p: &Path) -> bool {
    p.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("cmd") || e.eq_ignore_ascii_case("bat"))
        .unwrap_or(false)
}

/// Prefer `Code.exe` next to a `bin\code.cmd` launcher when present.
fn prefer_code_exe(cli: PathBuf) -> PathBuf {
    if !is_windows_batch(&cli) {
        return cli;
    }
    // …\Microsoft VS Code\bin\code.cmd → …\Microsoft VS Code\Code.exe
    if let Some(bin_dir) = cli.parent() {
        if let Some(install_dir) = bin_dir.parent() {
            let exe = install_dir.join("Code.exe");
            if path_ok(&exe) {
                return exe;
            }
            let insiders = install_dir.join("Code - Insiders.exe");
            if path_ok(&insiders) {
                return insiders;
            }
        }
    }
    cli
}

#[cfg(windows)]
fn push_install_candidates(out: &mut Vec<PathBuf>, install_dir: PathBuf) {
    out.push(install_dir.join("Code.exe"));
    out.push(install_dir.join("Code - Insiders.exe"));
    out.push(install_dir.join("bin").join("code.cmd"));
    out.push(install_dir.join("bin").join("code-insiders.cmd"));
}

#[cfg(windows)]
fn registry_install_dirs() -> Vec<PathBuf> {
    use winreg::enums::*;
    use winreg::RegKey;

    let mut dirs = Vec::new();
    let hives: &[(RegKey, &str)] = &[
        (RegKey::predef(HKEY_CURRENT_USER), r"Software\Microsoft\Windows\CurrentVersion\Uninstall"),
        (
            RegKey::predef(HKEY_LOCAL_MACHINE),
            r"Software\Microsoft\Windows\CurrentVersion\Uninstall",
        ),
        (
            RegKey::predef(HKEY_LOCAL_MACHINE),
            r"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
        ),
    ];

    for (root, subkey) in hives {
        let Ok(key) = root.open_subkey_with_flags(subkey, KEY_READ) else {
            continue;
        };
        for name in key.enum_keys().filter_map(|r| r.ok()) {
            let Ok(sub) = key.open_subkey_with_flags(&name, KEY_READ) else {
                continue;
            };
            let display: String = sub.get_value("DisplayName").unwrap_or_default();
            let lower = display.to_ascii_lowercase();
            if !(lower.contains("visual studio code") || lower.contains("vscode")) {
                continue;
            }
            if let Ok(loc) = sub.get_value::<String, _>("InstallLocation") {
                let p = PathBuf::from(loc.trim());
                if !p.as_os_str().is_empty() {
                    dirs.push(p);
                }
            }
        }
    }
    dirs
}

/// Resolve VS Code executable / CLI. Prefers `Code.exe` over `code.cmd`.
fn resolve_code_cli() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        let mut candidates: Vec<PathBuf> = Vec::new();

        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            push_install_candidates(
                &mut candidates,
                PathBuf::from(&local)
                    .join("Programs")
                    .join("Microsoft VS Code"),
            );
            push_install_candidates(
                &mut candidates,
                PathBuf::from(&local)
                    .join("Programs")
                    .join("Microsoft VS Code Insiders"),
            );
        }
        if let Ok(pf) = std::env::var("ProgramFiles") {
            push_install_candidates(
                &mut candidates,
                PathBuf::from(&pf).join("Microsoft VS Code"),
            );
            push_install_candidates(
                &mut candidates,
                PathBuf::from(&pf).join("Microsoft VS Code Insiders"),
            );
        }
        if let Ok(pf86) = std::env::var("ProgramFiles(x86)") {
            push_install_candidates(
                &mut candidates,
                PathBuf::from(&pf86).join("Microsoft VS Code"),
            );
        }

        for dir in registry_install_dirs() {
            push_install_candidates(&mut candidates, dir);
        }

        for c in &candidates {
            if path_ok(c) && !is_windows_batch(c) {
                return Some(c.clone());
            }
        }
        for c in &candidates {
            if path_ok(c) {
                return Some(prefer_code_exe(c.clone()));
            }
        }

        if let Ok(p) = which::which("code") {
            return Some(prefer_code_exe(p));
        }
        if let Ok(p) = which::which("code.cmd") {
            return Some(prefer_code_exe(p));
        }
        if let Ok(p) = which::which("code-insiders") {
            return Some(prefer_code_exe(p));
        }
    }

    #[cfg(not(windows))]
    {
        if let Ok(p) = which::which("code") {
            return Some(p);
        }
        if let Ok(p) = which::which("code-insiders") {
            return Some(p);
        }
    }

    #[cfg(target_os = "macos")]
    {
        for app in [
            "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
            "/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code",
        ] {
            let p = PathBuf::from(app);
            if path_ok(&p) {
                return Some(p);
            }
        }
    }
    #[cfg(target_os = "linux")]
    {
        for c in [
            "/usr/bin/code",
            "/usr/local/bin/code",
            "/snap/bin/code",
            "/var/lib/flatpak/exports/bin/com.visualstudio.code",
        ] {
            let p = PathBuf::from(c);
            if path_ok(&p) {
                return Some(p);
            }
        }
    }
    None
}

fn validate_folder(path: &str) -> Result<PathBuf, String> {
    let p = PathBuf::from(path.trim());
    if path.trim().is_empty() || path.contains('\0') {
        return Err("Invalid folder path.".into());
    }
    if !p.is_dir() {
        return Err("Folder not found.".into());
    }
    Ok(p)
}

/// Detect whether Visual Studio Code is installed and where.
#[tauri::command]
pub fn vscode_detect() -> VsCodeInfo {
    match resolve_code_cli() {
        Some(p) => VsCodeInfo {
            installed: true,
            path: Some(p.to_string_lossy().to_string()),
        },
        None => VsCodeInfo {
            installed: false,
            path: None,
        },
    }
}

/// Open a folder in Visual Studio Code.
#[tauri::command]
pub fn open_external_vscode(path: String) -> Result<(), String> {
    let folder = validate_folder(&path)?;
    let code = resolve_code_cli().ok_or_else(|| "VSCODE_CLI_MISSING".to_string())?;

    #[cfg(windows)]
    {
        // Spawning `.cmd` with CREATE_NO_WINDOW often fails (needs a console host).
        // Prefer Code.exe; for batch files use `cmd /C start "" /B …` without NO_WINDOW.
        if is_windows_batch(&code) {
            let status = Command::new("cmd.exe")
                .args([
                    "/C",
                    "start",
                    "",
                    "/B",
                    code.to_str().ok_or_else(|| {
                        "VS Code path is not valid UTF-8.".to_string()
                    })?,
                    folder
                        .to_str()
                        .ok_or_else(|| "Folder path is not valid UTF-8.".to_string())?,
                ])
                .spawn()
                .map_err(|e| format!("Failed to launch VS Code: {e}"))?;
            let _ = status;
            return Ok(());
        }

        let mut cmd = Command::new(&code);
        cmd.arg(folder.as_os_str());
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd.spawn()
            .map_err(|e| format!("Failed to launch VS Code: {e}"))?;
        return Ok(());
    }

    #[cfg(not(windows))]
    {
        Command::new(&code)
            .arg(folder.as_os_str())
            .spawn()
            .map_err(|e| format!("Failed to launch VS Code: {e}"))?;
        Ok(())
    }
}
