use std::path::{Path, PathBuf};
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn path_ok(p: &Path) -> bool {
    p.is_file()
}

/// Resolve `code` / `code.cmd` on PATH, then common install locations (Windows).
fn resolve_code_cli() -> Option<PathBuf> {
    if let Ok(p) = which::which("code") {
        return Some(p);
    }
    #[cfg(windows)]
    {
        if let Ok(p) = which::which("code.cmd") {
            return Some(p);
        }
        let mut candidates: Vec<PathBuf> = Vec::new();
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            candidates.push(
                PathBuf::from(&local)
                    .join("Programs")
                    .join("Microsoft VS Code")
                    .join("bin")
                    .join("code.cmd"),
            );
            candidates.push(
                PathBuf::from(&local)
                    .join("Programs")
                    .join("Microsoft VS Code")
                    .join("Code.exe"),
            );
        }
        if let Ok(pf) = std::env::var("ProgramFiles") {
            candidates.push(
                PathBuf::from(&pf)
                    .join("Microsoft VS Code")
                    .join("bin")
                    .join("code.cmd"),
            );
            candidates.push(
                PathBuf::from(&pf)
                    .join("Microsoft VS Code")
                    .join("Code.exe"),
            );
        }
        if let Ok(pf86) = std::env::var("ProgramFiles(x86)") {
            candidates.push(
                PathBuf::from(&pf86)
                    .join("Microsoft VS Code")
                    .join("bin")
                    .join("code.cmd"),
            );
        }
        for c in candidates {
            if path_ok(&c) {
                return Some(c);
            }
        }
    }
    #[cfg(target_os = "macos")]
    {
        let app = PathBuf::from(
            "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
        );
        if path_ok(&app) {
            return Some(app);
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

/// Open a folder in Visual Studio Code (`code` CLI).
#[tauri::command]
pub fn open_external_vscode(path: String) -> Result<(), String> {
    let folder = validate_folder(&path)?;
    let code = resolve_code_cli().ok_or_else(|| {
        "VSCODE_CLI_MISSING".to_string()
    })?;

    let mut cmd = Command::new(&code);
    cmd.arg(folder.as_os_str());

    #[cfg(windows)]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd.spawn()
        .map_err(|e| format!("Failed to launch VS Code: {e}"))?;
    Ok(())
}
