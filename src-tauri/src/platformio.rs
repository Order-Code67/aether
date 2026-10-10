use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

const PIO_OUTPUT_EVENT: &str = "pio-output";
const PIO_STATUS_EVENT: &str = "pio-status";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PioInfo {
    pub installed: bool,
    pub command: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PioProjectInfo {
    pub is_project: bool,
    pub ini_path: Option<String>,
    pub envs: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PioOutputPayload {
    pub stream: String,
    pub line: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PioStatusPayload {
    pub running: bool,
    pub task: Option<String>,
    pub success: Option<bool>,
    pub code: Option<i32>,
    pub error: Option<String>,
}

pub struct PioState {
    child: Arc<Mutex<Option<Child>>>,
    running: Arc<AtomicBool>,
}

impl Default for PioState {
    fn default() -> Self {
        Self {
            child: Arc::new(Mutex::new(None)),
            running: Arc::new(AtomicBool::new(false)),
        }
    }
}

fn resolve_pio_command() -> Option<String> {
    for candidate in ["pio", "platformio", "platformio.exe", "pio.exe"] {
        if let Ok(path) = which::which(candidate) {
            return Some(path.to_string_lossy().to_string());
        }
    }

    if let Ok(home) = std::env::var("USERPROFILE") {
        let candidates = [
            PathBuf::from(&home)
                .join(".platformio")
                .join("penv")
                .join("Scripts")
                .join("pio.exe"),
            PathBuf::from(&home)
                .join(".platformio")
                .join("penv")
                .join("Scripts")
                .join("platformio.exe"),
        ];
        for path in candidates {
            if path.is_file() {
                return Some(path.to_string_lossy().to_string());
            }
        }
    }

    None
}

fn parse_envs_from_ini(contents: &str) -> Vec<String> {
    let mut envs = Vec::new();
    for line in contents.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("[env:") {
            if let Some(name) = rest.strip_suffix(']') {
                let name = name.trim();
                if !name.is_empty() {
                    envs.push(name.to_string());
                }
            }
        }
    }
    envs
}

fn emit_status(app: &AppHandle, status: PioStatusPayload) {
    let _ = app.emit(PIO_STATUS_EVENT, status);
}

fn emit_line(app: &AppHandle, stream: &str, line: String) {
    let _ = app.emit(
        PIO_OUTPUT_EVENT,
        PioOutputPayload {
            stream: stream.to_string(),
            line,
        },
    );
}

#[tauri::command]
pub fn pio_detect() -> PioInfo {
    let Some(command) = resolve_pio_command() else {
        return PioInfo {
            installed: false,
            command: None,
            version: None,
        };
    };

    let version = Command::new(&command)
        .arg("--version")
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .ok()
        .and_then(|out| {
            let text = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if text.is_empty() {
                None
            } else {
                Some(text)
            }
        });

    PioInfo {
        installed: true,
        command: Some(command),
        version,
    }
}

#[tauri::command]
pub fn pio_inspect_project(cwd: String) -> Result<PioProjectInfo, String> {
    let root = PathBuf::from(&cwd);
    let ini = root.join("platformio.ini");
    if !ini.is_file() {
        return Ok(PioProjectInfo {
            is_project: false,
            ini_path: None,
            envs: Vec::new(),
        });
    }

    let contents = std::fs::read_to_string(&ini).map_err(|e| e.to_string())?;
    Ok(PioProjectInfo {
        is_project: true,
        ini_path: Some(ini.to_string_lossy().to_string()),
        envs: parse_envs_from_ini(&contents),
    })
}

#[tauri::command]
pub fn pio_run(
    app: AppHandle,
    state: State<'_, PioState>,
    cwd: String,
    task: String,
    env: Option<String>,
) -> Result<(), String> {
    if state.running.load(Ordering::SeqCst) {
        return Err("A PlatformIO task is already running.".into());
    }

    let command = resolve_pio_command().ok_or_else(|| {
        "PlatformIO CLI not found. Install PlatformIO Core and ensure `pio` is on PATH."
            .to_string()
    })?;

    let root = Path::new(&cwd);
    if !root.is_dir() {
        return Err(format!("Workspace folder does not exist: {cwd}"));
    }
    if !root.join("platformio.ini").is_file() {
        return Err("No platformio.ini in the workspace root.".into());
    }

    let mut args = vec!["run".to_string()];
    match task.as_str() {
        "build" => {}
        "upload" => {
            args.push("-t".into());
            args.push("upload".into());
        }
        "clean" => {
            args.push("-t".into());
            args.push("clean".into());
        }
        "compiledb" => {
            args.push("-t".into());
            args.push("compiledb".into());
        }
        other => return Err(format!("Unknown PlatformIO task: {other}")),
    }

    if let Some(env_name) = env.filter(|e| !e.is_empty()) {
        args.push("-e".into());
        args.push(env_name);
    }

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
        PioStatusPayload {
            running: true,
            task: Some(task.clone()),
            success: None,
            code: None,
            error: None,
        },
    );

    emit_line(&app, "system", format!("> {command} {}", args.join(" ")));
    emit_line(&app, "system", format!("cwd: {cwd}"));

    let mut child = Command::new(&command)
        .args(&args)
        .current_dir(&cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null())
        .spawn()
        .map_err(|e| {
            state.running.store(false, Ordering::SeqCst);
            format!("Failed to start PlatformIO: {e}")
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
    let task_name = task.clone();

    thread::spawn(move || {
        // Poll try_wait so we never hold the mutex across a blocking wait
        // (pio_cancel needs the lock to kill the child).
        let status = loop {
            let outcome = {
                let mut slot = child_slot.lock().unwrap_or_else(|e| e.into_inner());
                match slot.as_mut() {
                    None => Some(None), // cancelled / already cleared
                    Some(child) => match child.try_wait() {
                        Ok(Some(s)) => {
                            *slot = None;
                            Some(Some(s))
                        }
                        Ok(None) => None, // still running
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

            thread::sleep(std::time::Duration::from_millis(50));
        };

        // Skip duplicate status if cancel already cleared the running flag.
        if !running.swap(false, Ordering::SeqCst) && status.is_none() {
            return;
        }

        let (success, code) = match status {
            Some(s) => (Some(s.success()), s.code()),
            None => (Some(false), None),
        };

        if let Some(ok) = success {
            emit_line(
                &app_wait,
                "system",
                if ok {
                    format!("✔ {task_name} finished successfully")
                } else {
                    format!("✖ {task_name} failed (exit {code:?})")
                },
            );
        }

        emit_status(
            &app_wait,
            PioStatusPayload {
                running: false,
                task: Some(task_name),
                success,
                code,
                error: None,
            },
        );
    });

    Ok(())
}

#[tauri::command]
pub fn pio_cancel(app: AppHandle, state: State<'_, PioState>) -> Result<(), String> {
    let mut slot = state.child.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(mut child) = slot.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
    state.running.store(false, Ordering::SeqCst);
    emit_line(&app, "system", "■ PlatformIO task cancelled".into());
    emit_status(
        &app,
        PioStatusPayload {
            running: false,
            task: None,
            success: Some(false),
            code: None,
            error: Some("Cancelled".into()),
        },
    );
    Ok(())
}

#[tauri::command]
pub fn pio_is_running(state: State<'_, PioState>) -> bool {
    state.running.load(Ordering::SeqCst)
}

/// Create a new PlatformIO project via `pio project init`.
#[tauri::command]
pub fn pio_project_init(
    parent: String,
    name: String,
    board: String,
) -> Result<String, String> {
    let command = resolve_pio_command().ok_or_else(|| {
        "PlatformIO CLI not found. Install PlatformIO Core and ensure `pio` is on PATH."
            .to_string()
    })?;

    let name = name.trim();
    if name.is_empty()
        || name.contains('/')
        || name.contains('\\')
        || name.contains("..")
        || name.contains(':')
    {
        return Err("Invalid project name.".into());
    }

    let board = board.trim();
    if board.is_empty() || board.chars().any(|c| !(c.is_ascii_alphanumeric() || c == '_' || c == '-'))
    {
        return Err("Invalid board id.".into());
    }

    let parent_path = PathBuf::from(&parent);
    if !parent_path.is_dir() {
        return Err(format!("Parent folder does not exist: {parent}"));
    }

    let project_dir = parent_path.join(name);
    if project_dir.exists() {
        return Err(format!(
            "Folder already exists: {}",
            project_dir.to_string_lossy()
        ));
    }

    std::fs::create_dir_all(&project_dir).map_err(|e| e.to_string())?;

    let output = Command::new(&command)
        .args([
            "project",
            "init",
            "--board",
            board,
            "--project-dir",
            &project_dir.to_string_lossy(),
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("Failed to run pio project init: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let detail = if !stderr.trim().is_empty() {
            stderr.trim().to_string()
        } else {
            stdout.trim().to_string()
        };
        let _ = std::fs::remove_dir_all(&project_dir);
        return Err(if detail.is_empty() {
            "pio project init failed.".into()
        } else {
            detail
        });
    }

    Ok(project_dir.to_string_lossy().to_string())
}
