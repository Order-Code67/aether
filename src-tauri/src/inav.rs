use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InavConfiguratorInfo {
    pub installed: bool,
    pub path: Option<String>,
}

fn path_ok(p: &Path) -> bool {
    p.is_file()
}

fn push_exe_variants(out: &mut Vec<PathBuf>, dir: PathBuf) {
    out.push(dir.join("INAV Configurator.exe"));
    out.push(dir.join("inav-configurator.exe"));
    out.push(dir.join("INAV-Configurator.exe"));
}

/// Resolve iNav Configurator executable on Windows (common install layouts + PATH).
fn resolve_inav_configurator() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        let mut candidates: Vec<PathBuf> = Vec::new();

        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            let local = PathBuf::from(local);
            push_exe_variants(
                &mut candidates,
                local.join("Programs").join("inav-configurator"),
            );
            push_exe_variants(
                &mut candidates,
                local.join("Programs").join("INAV Configurator"),
            );
            push_exe_variants(&mut candidates, local.join("inav-configurator"));
            push_exe_variants(&mut candidates, local.join("INAV Configurator"));
        }

        if let Ok(pf) = std::env::var("ProgramFiles") {
            let pf = PathBuf::from(pf);
            push_exe_variants(&mut candidates, pf.join("INAV Configurator"));
            push_exe_variants(&mut candidates, pf.join("inav-configurator"));
        }

        if let Ok(pf86) = std::env::var("ProgramFiles(x86)") {
            let pf86 = PathBuf::from(pf86);
            push_exe_variants(&mut candidates, pf86.join("INAV Configurator"));
            push_exe_variants(&mut candidates, pf86.join("inav-configurator"));
        }

        if let Ok(path) = std::env::var("PATH") {
            for entry in path.split(';') {
                let dir = PathBuf::from(entry.trim());
                if dir.as_os_str().is_empty() {
                    continue;
                }
                push_exe_variants(&mut candidates, dir);
            }
        }

        for c in candidates {
            if path_ok(&c) {
                return Some(c);
            }
        }
        return None;
    }

    #[cfg(not(windows))]
    {
        // Best-effort: look for a binary name on PATH.
        let names = ["inav-configurator", "INAV Configurator"];
        for name in names {
            if let Ok(output) = Command::new("which").arg(name).output() {
                if output.status.success() {
                    let s = String::from_utf8_lossy(&output.stdout);
                    let p = PathBuf::from(s.trim());
                    if path_ok(&p) {
                        return Some(p);
                    }
                }
            }
        }
        None
    }
}

#[tauri::command]
pub fn inav_configurator_detect() -> InavConfiguratorInfo {
    match resolve_inav_configurator() {
        Some(p) => InavConfiguratorInfo {
            installed: true,
            path: Some(p.to_string_lossy().to_string()),
        },
        None => InavConfiguratorInfo {
            installed: false,
            path: None,
        },
    }
}

/// Launch iNav Configurator (disconnect Aether serial from the UI first).
#[tauri::command]
pub fn open_external_inav_configurator() -> Result<(), String> {
    let exe = resolve_inav_configurator().ok_or_else(|| "INAV_CONFIGURATOR_MISSING".to_string())?;

    #[cfg(windows)]
    {
        let exe_s = exe
            .to_str()
            .ok_or_else(|| "iNav Configurator path is not valid UTF-8.".to_string())?;
        Command::new("cmd.exe")
            .args(["/C", "start", "", exe_s])
            .spawn()
            .map_err(|e| format!("Failed to launch iNav Configurator: {e}"))?;
        return Ok(());
    }

    #[cfg(not(windows))]
    {
        Command::new(&exe)
            .spawn()
            .map_err(|e| format!("Failed to launch iNav Configurator: {e}"))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detect_does_not_panic() {
        let _ = inav_configurator_detect();
    }
}
