use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;

use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

const TERMINAL_DATA_EVENT: &str = "terminal-data";
const TERMINAL_EXIT_EVENT: &str = "terminal-exit";

static NEXT_ID: AtomicU32 = AtomicU32::new(1);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalCreated {
    pub id: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalDataPayload {
    pub id: u32,
    pub data: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalExitPayload {
    pub id: u32,
    pub code: Option<u32>,
}

struct TerminalSession {
    writer: Mutex<Box<dyn Write + Send>>,
    master: Mutex<Box<dyn MasterPty + Send>>,
    stop: Arc<AtomicBool>,
}

pub struct TerminalState {
    sessions: Mutex<HashMap<u32, Arc<TerminalSession>>>,
}

impl Default for TerminalState {
    fn default() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

fn default_shell() -> (String, Vec<String>) {
    #[cfg(windows)]
    {
        (
            "powershell.exe".to_string(),
            vec!["-NoLogo".to_string()],
        )
    }
    #[cfg(not(windows))]
    {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
        (shell, Vec::new())
    }
}

#[tauri::command]
pub fn terminal_create(
    app: AppHandle,
    state: State<'_, TerminalState>,
    cols: u16,
    rows: u16,
    cwd: Option<String>,
) -> Result<TerminalCreated, String> {
    let id = NEXT_ID.fetch_add(1, Ordering::SeqCst);
    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows: rows.max(2),
            cols: cols.max(2),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {e}"))?;

    let (program, args) = default_shell();
    let mut cmd = CommandBuilder::new(&program);
    for arg in args {
        cmd.arg(arg);
    }

    if let Some(dir) = cwd.filter(|d| !d.is_empty()) {
        cmd.cwd(dir);
    }

    #[cfg(not(windows))]
    {
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
    }

    let mut child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell ({program}): {e}"))?;

    // Critical on Windows ConPTY.
    drop(pair.slave);

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone PTY reader: {e}"))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to take PTY writer: {e}"))?;

    let stop = Arc::new(AtomicBool::new(false));
    let session = Arc::new(TerminalSession {
        writer: Mutex::new(writer),
        master: Mutex::new(pair.master),
        stop: Arc::clone(&stop),
    });

    {
        let mut sessions = state.sessions.lock().unwrap_or_else(|e| e.into_inner());
        sessions.insert(id, Arc::clone(&session));
    }

    let app_data = app.clone();
    let stop_reader = Arc::clone(&stop);
    thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            if stop_reader.load(Ordering::SeqCst) {
                break;
            }
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_data.emit(
                        TERMINAL_DATA_EVENT,
                        TerminalDataPayload { id, data: chunk },
                    );
                }
                Err(_) => break,
            }
        }
    });

    let app_exit = app.clone();
    let stop_waiter = Arc::clone(&stop);
    thread::spawn(move || {
        let code = match child.wait() {
            Ok(status) => {
                if status.success() {
                    Some(0u32)
                } else {
                    Some(1u32)
                }
            }
            Err(_) => None,
        };

        stop_waiter.store(true, Ordering::SeqCst);
        let _ = app_exit.emit(TERMINAL_EXIT_EVENT, TerminalExitPayload { id, code });
    });

    Ok(TerminalCreated { id })
}

#[tauri::command]
pub fn terminal_write(
    state: State<'_, TerminalState>,
    id: u32,
    data: String,
) -> Result<(), String> {
    let sessions = state.sessions.lock().unwrap_or_else(|e| e.into_inner());
    let session = sessions
        .get(&id)
        .ok_or_else(|| format!("Terminal {id} not found"))?;
    let mut writer = session
        .writer
        .lock()
        .map_err(|_| "Terminal writer lock poisoned".to_string())?;
    writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("Terminal write failed: {e}"))?;
    writer
        .flush()
        .map_err(|e| format!("Terminal flush failed: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn terminal_resize(
    state: State<'_, TerminalState>,
    id: u32,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let sessions = state.sessions.lock().unwrap_or_else(|e| e.into_inner());
    let session = sessions
        .get(&id)
        .ok_or_else(|| format!("Terminal {id} not found"))?;
    let master = session
        .master
        .lock()
        .map_err(|_| "Terminal master lock poisoned".to_string())?;
    master
        .resize(PtySize {
            rows: rows.max(2),
            cols: cols.max(2),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Terminal resize failed: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn terminal_close(state: State<'_, TerminalState>, id: u32) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(session) = sessions.remove(&id) {
        session.stop.store(true, Ordering::SeqCst);
        drop(session);
    }
    Ok(())
}
