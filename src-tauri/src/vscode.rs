use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;
use serde_json::{json, Map, Value};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VsCodeInfo {
    pub installed: bool,
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VsCodeGenerateResult {
    pub created: Vec<String>,
    pub merged: Vec<String>,
    pub skipped: Vec<String>,
}

const PIO_EXTENSION: &str = "platformio.platformio-ide";

fn path_ok(p: &Path) -> bool {
    p.is_file()
}

#[cfg(windows)]
fn is_windows_batch(p: &Path) -> bool {
    p.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("cmd") || e.eq_ignore_ascii_case("bat"))
        .unwrap_or(false)
}

/// Prefer `Code.exe` next to a `bin\code.cmd` launcher when present.
#[cfg(windows)]
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

fn utf8_path<'a>(p: &'a Path, what: &str) -> Result<&'a str, String> {
    p.to_str()
        .ok_or_else(|| format!("{what} path is not valid UTF-8."))
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
///
/// On Windows, never use `CREATE_NO_WINDOW` for `Code.exe` — that can hide the GUI.
/// Prefer `cmd /C start "" "Code.exe" "folder"` so the editor window appears.
#[tauri::command]
pub fn open_external_vscode(path: String) -> Result<(), String> {
    let folder = validate_folder(&path)?;
    let code = resolve_code_cli().ok_or_else(|| "VSCODE_CLI_MISSING".to_string())?;

    #[cfg(windows)]
    {
        let code_s = utf8_path(&code, "VS Code")?;
        let folder_s = utf8_path(&folder, "Folder")?;
        // `start "" <app> <args>` launches a GUI process without CREATE_NO_WINDOW.
        Command::new("cmd.exe")
            .args(["/C", "start", "", code_s, folder_s])
            .spawn()
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

fn read_json_value(path: &Path) -> Option<Value> {
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn write_pretty_json(path: &Path, value: &Value) -> Result<(), String> {
    let body = serde_json::to_string_pretty(value)
        .map_err(|e| format!("Failed to serialize {}: {e}", path.display()))?;
    fs::write(path, format!("{body}\n"))
        .map_err(|e| format!("Failed to write {}: {e}", path.display()))
}

fn merge_extensions(existing: Option<Value>) -> Value {
    let mut recs = vec![PIO_EXTENSION.to_string()];
    if let Some(Value::Object(map)) = existing {
        if let Some(Value::Array(arr)) = map.get("recommendations") {
            for item in arr {
                if let Value::String(s) = item {
                    let t = s.trim();
                    if !t.is_empty() && !recs.iter().any(|r| r == t) {
                        recs.push(t.to_string());
                    }
                }
            }
        }
    }
    json!({ "recommendations": recs })
}

fn merge_settings(existing: Option<Value>) -> Value {
    let defaults = json!({
        "files.associations": { "*.ino": "cpp" },
        "C_Cpp.errorSquiggles": "enabled"
    });
    let mut out: Map<String, Value> = match existing {
        Some(Value::Object(m)) => m,
        _ => Map::new(),
    };
    if let Value::Object(defs) = defaults {
        for (key, value) in defs {
            if !out.contains_key(&key) {
                out.insert(key, value);
                continue;
            }
            if key == "files.associations" {
                if let (Value::Object(def_assoc), Some(Value::Object(cur))) =
                    (&value, out.get(&key))
                {
                    let mut merged = def_assoc.clone();
                    for (k, v) in cur {
                        merged.insert(k.clone(), v.clone());
                    }
                    out.insert(key, Value::Object(merged));
                }
            }
        }
    }
    Value::Object(out)
}

fn default_cpp_properties() -> Value {
    json!({
        "configurations": [{
            "name": "PlatformIO",
            "includePath": ["${workspaceFolder}/**"],
            "defines": [],
            "compilerPath": "",
            "cStandard": "c11",
            "cppStandard": "c++17",
            "intelliSenseMode": "windows-gcc-x64",
            "compileCommands": "${workspaceFolder}/.pio/build/*/compile_commands.json"
        }],
        "version": 4
    })
}

/// Write / merge `.vscode` helpers for PlatformIO + C/C++ IntelliSense.
#[tauri::command]
pub fn vscode_generate_config(path: String) -> Result<VsCodeGenerateResult, String> {
    let folder = validate_folder(&path)?;
    let vscode_dir = folder.join(".vscode");
    fs::create_dir_all(&vscode_dir)
        .map_err(|e| format!("Failed to create .vscode: {e}"))?;

    let mut created = Vec::new();
    let mut merged = Vec::new();
    let mut skipped = Vec::new();

    // extensions.json
    {
        let rel = ".vscode/extensions.json".to_string();
        let file = vscode_dir.join("extensions.json");
        let existed = file.is_file();
        let existing = if existed { read_json_value(&file) } else { None };
        if existed && existing.is_none() {
            skipped.push(rel);
        } else {
            let payload = merge_extensions(existing);
            write_pretty_json(&file, &payload)?;
            if existed {
                merged.push(rel);
            } else {
                created.push(rel);
            }
        }
    }

    // settings.json
    {
        let rel = ".vscode/settings.json".to_string();
        let file = vscode_dir.join("settings.json");
        let existed = file.is_file();
        let existing = if existed { read_json_value(&file) } else { None };
        if existed && existing.is_none() {
            skipped.push(rel);
        } else {
            let payload = merge_settings(existing);
            write_pretty_json(&file, &payload)?;
            if existed {
                merged.push(rel);
            } else {
                created.push(rel);
            }
        }
    }

    // c_cpp_properties.json — create if missing; skip if present
    {
        let rel = ".vscode/c_cpp_properties.json".to_string();
        let file = vscode_dir.join("c_cpp_properties.json");
        if file.is_file() {
            skipped.push(rel);
        } else {
            write_pretty_json(&file, &default_cpp_properties())?;
            created.push(rel);
        }
    }

    Ok(VsCodeGenerateResult {
        created,
        merged,
        skipped,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn vscode_detect_finds_install() {
        let info = vscode_detect();
        assert!(info.installed, "expected VS Code installed");
        let p = info.path.expect("path");
        assert!(Path::new(&p).exists(), "missing {p}");
    }

    #[test]
    fn open_external_vscode_smoke() {
        let folder = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join("examples")
            .join("esp32-blink");
        assert!(folder.is_dir(), "missing {}", folder.display());
        open_external_vscode(folder.to_string_lossy().to_string()).expect("open");
    }

    #[test]
    fn vscode_generate_config_creates_files() {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis();
        let dir = std::env::temp_dir().join(format!("aether-vscode-gen-{stamp}"));
        fs::create_dir_all(&dir).unwrap();
        let result = vscode_generate_config(dir.to_string_lossy().to_string()).expect("gen");
        assert!(result.created.iter().any(|f| f.ends_with("extensions.json")));
        assert!(result.created.iter().any(|f| f.ends_with("settings.json")));
        assert!(result
            .created
            .iter()
            .any(|f| f.ends_with("c_cpp_properties.json")));
        // second run merges / skips
        let again = vscode_generate_config(dir.to_string_lossy().to_string()).expect("gen2");
        assert!(again.merged.iter().any(|f| f.ends_with("extensions.json")));
        assert!(again
            .skipped
            .iter()
            .any(|f| f.ends_with("c_cpp_properties.json")));
        let _ = fs::remove_dir_all(&dir);
    }
}
