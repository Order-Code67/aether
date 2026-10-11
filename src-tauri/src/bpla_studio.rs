//! Detect and launch БПЛА-Студия (standalone FC configurator) with optional COM handoff.

use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BplaStudioInfo {
    pub installed: bool,
    pub path: Option<String>,
}

fn path_ok(p: &Path) -> bool {
    p.is_file()
}

fn push_exe_variants(out: &mut Vec<PathBuf>, dir: PathBuf) {
    out.push(dir.join("БПЛА-Студия.exe"));
    out.push(dir.join("bpla-studio.exe"));
    out.push(dir.join("BPLA Studio.exe"));
    out.push(dir.join("bpla_studio.exe"));
}

fn resolve_bpla_studio() -> Option<PathBuf> {
    if let Ok(override_path) = std::env::var("AETHER_BPLA_STUDIO") {
        let p = PathBuf::from(override_path.trim());
        if path_ok(&p) {
            return Some(p);
        }
    }

    #[cfg(windows)]
    {
        let mut candidates: Vec<PathBuf> = Vec::new();

        // Dev / sibling build next to Aether repo or installer
        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                push_exe_variants(&mut candidates, dir.to_path_buf());
                push_exe_variants(&mut candidates, dir.join("..").join("bpla-studio"));
                // Monorepo release layout
                push_exe_variants(
                    &mut candidates,
                    dir.join("..")
                        .join("..")
                        .join("apps")
                        .join("bpla-studio")
                        .join("src-tauri")
                        .join("target")
                        .join("release"),
                );
            }
        }

        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            let local = PathBuf::from(local);
            push_exe_variants(
                &mut candidates,
                local.join("Programs").join("БПЛА-Студия"),
            );
            push_exe_variants(
                &mut candidates,
                local.join("Programs").join("bpla-studio"),
            );
            push_exe_variants(&mut candidates, local.join("bpla-studio"));
        }

        if let Ok(pf) = std::env::var("ProgramFiles") {
            let pf = PathBuf::from(pf);
            push_exe_variants(&mut candidates, pf.join("БПЛА-Студия"));
            push_exe_variants(&mut candidates, pf.join("bpla-studio"));
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
        let names = ["bpla-studio", "БПЛА-Студия"];
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
pub fn bpla_studio_detect() -> BplaStudioInfo {
    match resolve_bpla_studio() {
        Some(p) => BplaStudioInfo {
            installed: true,
            path: Some(p.to_string_lossy().to_string()),
        },
        None => BplaStudioInfo {
            installed: false,
            path: None,
        },
    }
}

/// Launch БПЛА-Студия. Optional COM handoff: `--port COMx --baud 115200`.
#[tauri::command]
pub fn open_bpla_studio(port: Option<String>, baud: Option<u32>) -> Result<(), String> {
    let exe = resolve_bpla_studio().ok_or_else(|| "BPLA_STUDIO_MISSING".to_string())?;

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
            .ok_or_else(|| "БПЛА-Студия path is not valid UTF-8.".to_string())?;
        // `start` with empty title; pass remaining args to the exe.
        let mut cmd_args = vec!["/C".to_string(), "start".to_string(), "".to_string(), exe_s.to_string()];
        cmd_args.extend(args);
        Command::new("cmd.exe")
            .args(&cmd_args)
            .spawn()
            .map_err(|e| format!("Failed to launch БПЛА-Студия: {e}"))?;
        return Ok(());
    }

    #[cfg(not(windows))]
    {
        Command::new(&exe)
            .args(&args)
            .spawn()
            .map_err(|e| format!("Failed to launch БПЛА-Студия: {e}"))?;
        Ok(())
    }
}
