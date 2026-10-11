//! DFU helpers for iNav / STM32 flight-controller `.hex` flash via `dfu-util`.

use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DfuUtilInfo {
    pub installed: bool,
    pub path: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DfuListResult {
    pub tool_installed: bool,
    pub devices: Vec<String>,
    pub raw: String,
    pub error: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DfuOutputPayload {
    stream: String,
    line: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DfuStatusPayload {
    running: bool,
    success: Option<bool>,
    code: Option<i32>,
    error: Option<String>,
}

#[derive(Clone, Default)]
pub struct DfuState {
    pub running: Arc<AtomicBool>,
    pub child: Arc<Mutex<Option<std::process::Child>>>,
}

fn path_ok(p: &Path) -> bool {
    p.is_file()
}

fn resolve_dfu_util() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        let mut candidates: Vec<PathBuf> = Vec::new();
        if let Ok(path) = std::env::var("PATH") {
            for entry in path.split(';') {
                let dir = PathBuf::from(entry.trim());
                if dir.as_os_str().is_empty() {
                    continue;
                }
                candidates.push(dir.join("dfu-util.exe"));
                candidates.push(dir.join("dfu-util"));
            }
        }
        if let Ok(pf) = std::env::var("ProgramFiles") {
            let base = PathBuf::from(pf);
            candidates.push(base.join("dfu-util").join("dfu-util.exe"));
        }
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            candidates.push(
                PathBuf::from(local)
                    .join("dfu-util")
                    .join("dfu-util.exe"),
            );
        }
        for c in candidates {
            if path_ok(&c) {
                return Some(c);
            }
        }
        if let Ok(output) = Command::new("where").arg("dfu-util").output() {
            if output.status.success() {
                let s = String::from_utf8_lossy(&output.stdout);
                if let Some(line) = s.lines().next() {
                    let p = PathBuf::from(line.trim());
                    if path_ok(&p) {
                        return Some(p);
                    }
                }
            }
        }
        return None;
    }

    #[cfg(not(windows))]
    {
        if let Ok(output) = Command::new("which").arg("dfu-util").output() {
            if output.status.success() {
                let s = String::from_utf8_lossy(&output.stdout);
                let p = PathBuf::from(s.trim());
                if path_ok(&p) {
                    return Some(p);
                }
            }
        }
        None
    }
}

fn emit_line(app: &AppHandle, stream: &str, line: String) {
    let _ = app.emit(
        "dfu-output",
        DfuOutputPayload {
            stream: stream.to_string(),
            line,
        },
    );
}

fn emit_status(app: &AppHandle, status: DfuStatusPayload) {
    let _ = app.emit("dfu-status", status);
}

#[tauri::command]
pub fn dfu_util_detect() -> DfuUtilInfo {
    match resolve_dfu_util() {
        Some(p) => {
            let version = Command::new(&p)
                .arg("--version")
                .output()
                .ok()
                .and_then(|o| {
                    let s = String::from_utf8_lossy(&o.stdout);
                    s.lines().next().map(|l| l.trim().to_string())
                });
            DfuUtilInfo {
                installed: true,
                path: Some(p.to_string_lossy().to_string()),
                version,
            }
        }
        None => DfuUtilInfo {
            installed: false,
            path: None,
            version: None,
        },
    }
}

#[tauri::command]
pub fn dfu_list_devices() -> DfuListResult {
    let Some(tool) = resolve_dfu_util() else {
        return DfuListResult {
            tool_installed: false,
            devices: vec![],
            raw: String::new(),
            error: Some("DFU_UTIL_MISSING".into()),
        };
    };

    match Command::new(&tool).arg("-l").output() {
        Ok(output) => {
            let raw = format!(
                "{}{}",
                String::from_utf8_lossy(&output.stdout),
                String::from_utf8_lossy(&output.stderr)
            );
            let devices: Vec<String> = raw
                .lines()
                .filter(|l| {
                    let lower = l.to_lowercase();
                    lower.contains("found dfu")
                        || lower.contains("[0")
                        || (lower.contains("vid") && lower.contains("pid"))
                })
                .map(|l| l.trim().to_string())
                .collect();
            DfuListResult {
                tool_installed: true,
                devices,
                raw,
                error: None,
            }
        }
        Err(e) => DfuListResult {
            tool_installed: true,
            devices: vec![],
            raw: String::new(),
            error: Some(format!("DFU_LIST_FAILED: {e}")),
        },
    }
}

#[tauri::command]
pub fn dfu_flash_hex(
    app: AppHandle,
    state: tauri::State<'_, DfuState>,
    hex_path: String,
) -> Result<(), String> {
    if state.running.load(Ordering::SeqCst) {
        return Err("A DFU flash is already running.".into());
    }

    let path = PathBuf::from(&hex_path);
    if !path.is_file() {
        return Err("DFU_HEX_NOT_FOUND".into());
    }
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    if ext != "hex" && ext != "bin" {
        return Err("DFU_HEX_INVALID".into());
    }

    let Some(tool) = resolve_dfu_util() else {
        return Err("DFU_UTIL_MISSING".into());
    };

    {
        let mut slot = state.child.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(mut child) = slot.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    state.running.store(true, Ordering::SeqCst);
    emit_status(
        &app,
        DfuStatusPayload {
            running: true,
            success: None,
            code: None,
            error: None,
        },
    );

    // Classic STM32 DFU (ST bootloader VID:PID 0483:df11).
    let args = vec![
        "-a".into(),
        "0".into(),
        "-d".into(),
        "0483:df11".into(),
        "-s".into(),
        "0x08000000:leave".into(),
        "-D".into(),
        hex_path.clone(),
    ];

    emit_line(
        &app,
        "system",
        format!("> {} {}", tool.display(), args.join(" ")),
    );

    let mut child_cmd = Command::new(&tool);
    child_cmd
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        child_cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = child_cmd.spawn().map_err(|e| {
        state.running.store(false, Ordering::SeqCst);
        format!("Failed to start dfu-util: {e}")
    })?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    {
        let mut slot = state.child.lock().unwrap_or_else(|e| e.into_inner());
        *slot = Some(child);
    }

    let app_out = app.clone();
    if let Some(out) = stdout {
        thread::spawn(move || {
            let reader = BufReader::new(out);
            for line in reader.lines().map_while(Result::ok) {
                emit_line(&app_out, "stdout", line);
            }
        });
    }
    let app_err = app.clone();
    if let Some(err) = stderr {
        thread::spawn(move || {
            let reader = BufReader::new(err);
            for line in reader.lines().map_while(Result::ok) {
                emit_line(&app_err, "stderr", line);
            }
        });
    }

    let app_wait = app.clone();
    let child_slot = Arc::clone(&state.child);
    let running = Arc::clone(&state.running);

    thread::spawn(move || {
        let status = loop {
            let outcome = {
                let mut slot = child_slot.lock().unwrap_or_else(|e| e.into_inner());
                match slot.as_mut() {
                    None => Some(None),
                    Some(child) => match child.try_wait() {
                        Ok(Some(s)) => {
                            *slot = None;
                            Some(Some(s))
                        }
                        Ok(None) => None,
                        Err(_) => {
                            *slot = None;
                            Some(None)
                        }
                    },
                }
            };
            if let Some(done) = outcome {
                break done;
            }
            thread::sleep(Duration::from_millis(50));
        };

        let (success, code, error) = match status {
            Some(s) => {
                let code = s.code();
                let ok = s.success();
                (
                    Some(ok),
                    code,
                    if ok {
                        None
                    } else {
                        Some("DFU_FLASH_FAILED".into())
                    },
                )
            }
            None => (Some(false), None, Some("DFU_FLASH_ABORTED".into())),
        };

        running.store(false, Ordering::SeqCst);
        emit_status(
            &app_wait,
            DfuStatusPayload {
                running: false,
                success,
                code,
                error,
            },
        );
    });

    Ok(())
}
