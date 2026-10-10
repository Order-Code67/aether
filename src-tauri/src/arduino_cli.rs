//! Arduino CLI detection, library search, and install into project `lib/`.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use serde::Serialize;

use crate::platformio::PioLibEntry;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArduinoCliInfo {
    pub installed: bool,
    pub path: Option<String>,
    pub version: Option<String>,
}

fn resolve_arduino_cli() -> Option<PathBuf> {
    #[cfg(windows)]
    let candidates = ["arduino-cli.exe", "arduino-cli"];
    #[cfg(not(windows))]
    let candidates = ["arduino-cli"];

    for name in candidates {
        if let Ok(path) = which::which(name) {
            return Some(path);
        }
    }
    None
}

fn run_cli(cli: &Path, args: &[&str], cwd: Option<&Path>) -> Result<std::process::Output, String> {
    let mut cmd = Command::new(cli);
    cmd.args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd.output()
        .map_err(|e| format!("Failed to run arduino-cli: {e}"))
}

fn failure_detail(output: &std::process::Output, fallback: &str) -> String {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if !stderr.is_empty() {
        stderr
    } else if !stdout.is_empty() {
        stdout
    } else {
        fallback.to_string()
    }
}

fn validate_lib_name(name: &str) -> Result<&str, String> {
    let n = name.trim();
    if n.is_empty() || n.len() > 120 {
        return Err("Invalid library name.".into());
    }
    if n.contains("..") || n.contains('/') || n.contains('\\') || n.contains('\0') {
        return Err("Invalid library name.".into());
    }
    if n.chars().any(|c| {
        matches!(
            c,
            ';' | '|' | '&' | '`' | '$' | '\n' | '\r' | '<' | '>' | '"' | '\''
        )
    }) {
        return Err("Invalid library name.".into());
    }
    Ok(n)
}

/// Detect `arduino-cli` on PATH.
#[tauri::command]
pub fn arduino_cli_detect() -> Result<ArduinoCliInfo, String> {
    let Some(path) = resolve_arduino_cli() else {
        return Ok(ArduinoCliInfo {
            installed: false,
            path: None,
            version: None,
        });
    };
    let output = run_cli(&path, &["version", "--format", "text"], None)?;
    let version = if output.status.success() {
        let text = String::from_utf8_lossy(&output.stdout);
        let line = text.lines().next().unwrap_or("").trim();
        if line.is_empty() {
            None
        } else {
            Some(line.to_string())
        }
    } else {
        None
    };
    Ok(ArduinoCliInfo {
        installed: true,
        path: Some(path.display().to_string()),
        version,
    })
}

/// Search Arduino Library Manager via `arduino-cli lib search --format json`.
#[tauri::command]
pub fn arduino_cli_lib_search(query: String) -> Result<Vec<PioLibEntry>, String> {
    let cli = resolve_arduino_cli().ok_or_else(|| {
        "arduino-cli not found on PATH. Install from https://arduino.github.io/arduino-cli/"
            .to_string()
    })?;
    let q = query.trim();
    if q.is_empty() {
        return Ok(vec![]);
    }
    if q.len() > 120 {
        return Err("Search query too long.".into());
    }

    let output = run_cli(&cli, &["lib", "search", q, "--format", "json"], None)?;
    if !output.status.success() {
        return Err(failure_detail(&output, "arduino-cli lib search failed."));
    }

    Ok(parse_lib_search_json(&output.stdout))
}

fn parse_lib_search_json(stdout: &[u8]) -> Vec<PioLibEntry> {
    let text = String::from_utf8_lossy(stdout);
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return vec![];
    }
    let value: serde_json::Value = match serde_json::from_str(trimmed) {
        Ok(v) => v,
        Err(_) => return vec![],
    };

    let items = value
        .get("libraries")
        .and_then(|v| v.as_array())
        .cloned()
        .or_else(|| value.as_array().cloned())
        .unwrap_or_default();

    let mut out = Vec::new();
    for item in items.into_iter().take(40) {
        let name = item
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if name.is_empty() {
            continue;
        }
        let latest = item.get("latest").cloned().unwrap_or(serde_json::Value::Null);
        let version = latest
            .get("version")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let description = latest
            .get("sentence")
            .or_else(|| latest.get("paragraph"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let owner = latest
            .get("author")
            .and_then(|v| v.as_str())
            .unwrap_or("arduino")
            .to_string();
        let id = format!("arduino:{name}");
        out.push(PioLibEntry {
            id,
            name,
            owner,
            description,
            version,
            platforms: vec!["arduino".into()],
        });
    }
    out
}

/// Install a library into the project's PlatformIO-compatible `lib/` folder.
///
/// Uses a temporary Arduino user dir, then moves `{user}/libraries/<Name>` → `{cwd}/lib/<Name>`.
#[tauri::command]
pub fn arduino_cli_lib_install(cwd: String, library: String) -> Result<String, String> {
    let cli = resolve_arduino_cli().ok_or_else(|| {
        "arduino-cli not found on PATH. Install from https://arduino.github.io/arduino-cli/"
            .to_string()
    })?;
    let name = validate_lib_name(&library)?;
    let project = PathBuf::from(&cwd);
    if !project.is_dir() {
        return Err("Project folder not found.".into());
    }
    let ini = project.join("platformio.ini");
    if !ini.is_file() {
        return Err("Open a PlatformIO project (platformio.ini) first.".into());
    }

    let staging = project.join(".aether").join("arduino_user");
    let staging_libs = staging.join("libraries");
    fs::create_dir_all(&staging_libs).map_err(|e| format!("Cannot create staging dir: {e}"))?;

    let mut cmd = Command::new(&cli);
    cmd.args(["lib", "install", name])
        .env("ARDUINO_DIRECTORIES_USER", &staging)
        .current_dir(&project)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let output = cmd
        .output()
        .map_err(|e| format!("Failed to run arduino-cli lib install: {e}"))?;
    if !output.status.success() {
        return Err(failure_detail(&output, "arduino-cli lib install failed."));
    }

    let installed_dir = find_installed_lib_dir(&staging_libs, name)
        .ok_or_else(|| format!("Library installed but folder not found under staging: {name}"))?;

    let lib_root = project.join("lib");
    fs::create_dir_all(&lib_root).map_err(|e| format!("Cannot create lib/: {e}"))?;
    let dest = lib_root.join(
        installed_dir
            .file_name()
            .ok_or_else(|| "Invalid library folder name.".to_string())?,
    );
    if dest.exists() {
        fs::remove_dir_all(&dest).map_err(|e| format!("Cannot replace existing lib: {e}"))?;
    }
    fs::rename(&installed_dir, &dest)
        .or_else(|_| copy_dir_recursive(&installed_dir, &dest).and_then(|_| {
            let _ = fs::remove_dir_all(&installed_dir);
            Ok(())
        }))
        .map_err(|e| format!("Failed to move library into lib/: {e}"))?;

    // Best-effort cleanup of staging leftovers.
    let _ = fs::remove_dir_all(&staging);

    Ok(format!(
        "Installed {name} into {}",
        dest.display()
    ))
}

fn find_installed_lib_dir(libraries: &Path, name: &str) -> Option<PathBuf> {
    if !libraries.is_dir() {
        return None;
    }
    let exact = libraries.join(name);
    if exact.is_dir() {
        return Some(exact);
    }
    // Case-insensitive / spaced name fallback.
    let want = name.to_lowercase().replace(' ', "_");
    let want_spaced = name.to_lowercase();
    let entries = fs::read_dir(libraries).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let folder = entry.file_name().to_string_lossy().to_lowercase();
        if folder == want_spaced || folder.replace(' ', "_") == want {
            return Some(path);
        }
    }
    // If only one new folder exists, use it.
    let dirs: Vec<_> = fs::read_dir(libraries)
        .ok()?
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.is_dir())
        .collect();
    if dirs.len() == 1 {
        return dirs.into_iter().next();
    }
    None
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        if from.is_dir() {
            copy_dir_recursive(&from, &to)?;
        } else {
            fs::copy(&from, &to).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// List library folder names under project `lib/` (arduino-cli installs).
#[tauri::command]
pub fn arduino_cli_lib_list(cwd: String) -> Result<Vec<String>, String> {
    let lib_root = PathBuf::from(&cwd).join("lib");
    if !lib_root.is_dir() {
        return Ok(vec![]);
    }
    let mut names = Vec::new();
    for entry in fs::read_dir(&lib_root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_dir() {
            if let Some(name) = entry.file_name().to_str() {
                if !name.starts_with('.') {
                    names.push(name.to_string());
                }
            }
        }
    }
    names.sort();
    Ok(names)
}
