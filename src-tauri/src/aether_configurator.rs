//! Detect and launch Aether Configurator (Electron FC companion) with optional COM handoff.
//! Target path for БПЛА work — not a replacement for the Arduino IDE core.

use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AetherConfiguratorInfo {
    pub installed: bool,
    pub path: Option<String>,
}

fn path_ok(p: &Path) -> bool {
    p.is_file()
}

fn push_exe_variants(out: &mut Vec<PathBuf>, dir: PathBuf) {
    out.push(dir.join("Aether Configurator.exe"));
    out.push(dir.join("AetherConfigurator.exe"));
    out.push(dir.join("aether-configurator.exe"));
}

fn resolve_aether_configurator() -> Option<PathBuf> {
    if let Ok(override_path) = std::env::var("AETHER_CONFIGURATOR") {
        let p = PathBuf::from(override_path.trim());
        if path_ok(&p) {
            return Some(p);
        }
    }

    #[cfg(windows)]
    {
        let mut candidates: Vec<PathBuf> = Vec::new();

        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                push_exe_variants(&mut candidates, dir.to_path_buf());
                push_exe_variants(
                    &mut candidates,
                    dir.join("..").join("Aether Configurator"),
                );
                // Monorepo electron-builder output
                push_exe_variants(
                    &mut candidates,
                    dir.join("..")
                        .join("..")
                        .join("apps")
                        .join("aether-configurator")
                        .join("release")
                        .join("win-unpacked"),
                );
                push_exe_variants(
                    &mut candidates,
                    dir.join("..")
                        .join("..")
                        .join("apps")
                        .join("aether-configurator")
                        .join("release"),
                );
            }
        }

        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            let local = PathBuf::from(local);
            push_exe_variants(
                &mut candidates,
                local.join("Programs").join("Aether Configurator"),
            );
            push_exe_variants(
                &mut candidates,
                local.join("Programs").join("aether-configurator"),
            );
        }

        if let Ok(pf) = std::env::var("ProgramFiles") {
            let pf = PathBuf::from(pf);
            push_exe_variants(&mut candidates, pf.join("Aether Configurator"));
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
            if let Ok(canon) = c.canonicalize() {
                if path_ok(&canon) {
                    return Some(canon);
                }
            } else if path_ok(&c) {
                return Some(c);
            }
        }
        return None;
    }

    #[cfg(not(windows))]
    {
        for name in ["aether-configurator", "Aether Configurator"] {
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
pub fn aether_configurator_detect() -> AetherConfiguratorInfo {
    match resolve_aether_configurator() {
        Some(p) => AetherConfiguratorInfo {
            installed: true,
            path: Some(p.to_string_lossy().to_string()),
        },
        None => AetherConfiguratorInfo {
            installed: false,
            path: None,
        },
    }
}

/// Launch Aether Configurator. Optional COM handoff: `--port COMx --baud 115200`.
#[tauri::command]
pub fn open_aether_configurator(port: Option<String>, baud: Option<u32>) -> Result<(), String> {
    let exe =
        resolve_aether_configurator().ok_or_else(|| "AETHER_CONFIGURATOR_MISSING".to_string())?;

    let mut args: Vec<String> = Vec::new();
    if let Some(p) = port.filter(|s| !s.trim().is_empty()) {
        args.push("--port".into());
        args.push(p);
    }
    if let Some(b) = baud.filter(|n| *n > 0) {
        args.push("--baud".into());
        args.push(b.to_string());
    }

    #[cfg(windows)]
    {
        let exe_s = exe
            .to_str()
            .ok_or_else(|| "Aether Configurator path is not valid UTF-8.".to_string())?;
        let mut cmd_args = vec![
            "/C".to_string(),
            "start".to_string(),
            "".to_string(),
            exe_s.to_string(),
        ];
        cmd_args.extend(args);
        Command::new("cmd.exe")
            .args(&cmd_args)
            .spawn()
            .map_err(|e| format!("Failed to launch Aether Configurator: {e}"))?;
        return Ok(());
    }

    #[cfg(not(windows))]
    {
        Command::new(&exe)
            .args(&args)
            .spawn()
            .map_err(|e| format!("Failed to launch Aether Configurator: {e}"))?;
        Ok(())
    }
}
