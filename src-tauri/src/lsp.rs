use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, State};

const LSP_NOTIFICATION_EVENT: &str = "lsp-notification";
const LSP_STATUS_EVENT: &str = "lsp-status";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LspInfo {
    pub installed: bool,
    pub command: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LspStatusPayload {
    pub running: bool,
    pub root: Option<String>,
    pub compile_commands_dir: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LspNotificationPayload {
    pub method: String,
    pub params: Value,
}

struct Pending {
    tx: Sender<Result<Value, String>>,
}

struct Session {
    child: Child,
    stdin: ChildStdin,
    stop_reader: Arc<AtomicBool>,
}

pub struct LspState {
    session: Mutex<Option<Session>>,
    next_id: AtomicU64,
    pending: Arc<Mutex<HashMap<u64, Pending>>>,
    running: AtomicBool,
    root: Mutex<Option<String>>,
    compile_commands_dir: Mutex<Option<String>>,
}

impl Default for LspState {
    fn default() -> Self {
        Self {
            session: Mutex::new(None),
            next_id: AtomicU64::new(1),
            pending: Arc::new(Mutex::new(HashMap::new())),
            running: AtomicBool::new(false),
            root: Mutex::new(None),
            compile_commands_dir: Mutex::new(None),
        }
    }
}

fn resolve_clangd() -> Option<String> {
    for name in ["clangd", "clangd.exe"] {
        if let Ok(path) = which::which(name) {
            return Some(path.to_string_lossy().to_string());
        }
    }
    if let Ok(program_files) = std::env::var("ProgramFiles") {
        let pattern = PathBuf::from(program_files)
            .join("LLVM")
            .join("bin")
            .join("clangd.exe");
        if pattern.is_file() {
            return Some(pattern.to_string_lossy().to_string());
        }
    }
    None
}

fn path_to_uri(path: &str) -> String {
    let mut s = path.replace('\\', "/");
    if s.len() >= 2 && s.as_bytes().get(1) == Some(&b':') {
        return format!("file:///{s}");
    }
    if !s.starts_with('/') {
        s = format!("/{s}");
    }
    format!("file://{s}")
}

fn find_compile_commands_dir(root: &Path) -> Option<PathBuf> {
    if root.join("compile_commands.json").is_file() {
        return Some(root.to_path_buf());
    }
    let pio_build = root.join(".pio").join("build");
    if pio_build.is_dir() {
        if let Ok(entries) = std::fs::read_dir(&pio_build) {
            let mut dirs: Vec<PathBuf> = entries
                .flatten()
                .map(|e| e.path())
                .filter(|p| p.is_dir() && p.join("compile_commands.json").is_file())
                .collect();
            dirs.sort();
            if let Some(dir) = dirs.into_iter().next() {
                return Some(dir);
            }
        }
    }
    if root.join("build").join("compile_commands.json").is_file() {
        return Some(root.join("build"));
    }
    None
}

fn write_rpc(stdin: &mut ChildStdin, body: &Value) -> Result<(), String> {
    let payload = serde_json::to_string(body).map_err(|e| e.to_string())?;
    let header = format!("Content-Length: {}\r\n\r\n", payload.len());
    stdin
        .write_all(header.as_bytes())
        .and_then(|_| stdin.write_all(payload.as_bytes()))
        .and_then(|_| stdin.flush())
        .map_err(|e| format!("Failed to write to clangd: {e}"))
}

fn read_message(reader: &mut BufReader<impl Read>) -> Result<Value, String> {
    let mut content_length: Option<usize> = None;
    loop {
        let mut line = String::new();
        let n = reader
            .read_line(&mut line)
            .map_err(|e| format!("LSP read error: {e}"))?;
        if n == 0 {
            return Err("LSP stdout closed.".into());
        }
        let trimmed = line.trim_end();
        if trimmed.is_empty() {
            break;
        }
        if let Some(rest) = trimmed.strip_prefix("Content-Length:") {
            content_length = Some(
                rest.trim()
                    .parse()
                    .map_err(|_| "Invalid Content-Length".to_string())?,
            );
        }
    }
    let len = content_length.ok_or_else(|| "Missing Content-Length".to_string())?;
    let mut buf = vec![0u8; len];
    reader
        .read_exact(&mut buf)
        .map_err(|e| format!("LSP body read error: {e}"))?;
    serde_json::from_slice(&buf).map_err(|e| format!("Invalid LSP JSON: {e}"))
}

fn stop_session(state: &LspState) {
    state.running.store(false, Ordering::SeqCst);
    if let Ok(mut slot) = state.session.lock() {
        if let Some(mut session) = slot.take() {
            session.stop_reader.store(true, Ordering::SeqCst);
            let _ = session.child.kill();
            let _ = session.child.wait();
        }
    }
    if let Ok(mut pending) = state.pending.lock() {
        for (_, p) in pending.drain() {
            let _ = p.tx.send(Err("LSP stopped.".into()));
        }
    }
    if let Ok(mut root) = state.root.lock() {
        *root = None;
    }
    if let Ok(mut dir) = state.compile_commands_dir.lock() {
        *dir = None;
    }
}

fn status_payload(state: &LspState, error: Option<String>) -> LspStatusPayload {
    LspStatusPayload {
        running: state.running.load(Ordering::SeqCst),
        root: state.root.lock().ok().and_then(|g| g.clone()),
        compile_commands_dir: state
            .compile_commands_dir
            .lock()
            .ok()
            .and_then(|g| g.clone()),
        error,
    }
}

#[tauri::command]
pub fn lsp_detect() -> LspInfo {
    let Some(command) = resolve_clangd() else {
        return LspInfo {
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
        .and_then(|o| {
            let text = String::from_utf8_lossy(&o.stdout);
            let line = text.lines().next()?.trim().to_string();
            if line.is_empty() {
                None
            } else {
                Some(line)
            }
        });
    LspInfo {
        installed: true,
        command: Some(command),
        version,
    }
}

#[tauri::command]
pub fn lsp_start(
    app: AppHandle,
    state: State<'_, LspState>,
    root: String,
) -> Result<LspStatusPayload, String> {
    if state.running.load(Ordering::SeqCst) {
        stop_session(&state);
        thread::sleep(Duration::from_millis(80));
    }

    let clangd = resolve_clangd().ok_or_else(|| {
        "clangd not found. Install LLVM/clangd and ensure it is on PATH.".to_string()
    })?;

    let root_path = PathBuf::from(&root);
    if !root_path.is_dir() {
        return Err(format!("Not a directory: {root}"));
    }

    let compile_dir = find_compile_commands_dir(&root_path);
    let mut args = vec![
        "--background-index".to_string(),
        "--clang-tidy=false".to_string(),
        "--header-insertion=never".to_string(),
        "--log=error".to_string(),
    ];
    if let Some(ref dir) = compile_dir {
        args.push(format!("--compile-commands-dir={}", dir.to_string_lossy()));
    }

    let mut child = Command::new(&clangd)
        .args(&args)
        .current_dir(&root_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start clangd: {e}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "clangd stdout missing".to_string())?;
    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "clangd stdin missing".to_string())?;

    let stop_reader = Arc::new(AtomicBool::new(false));
    {
        let mut slot = state.session.lock().unwrap_or_else(|e| e.into_inner());
        *slot = Some(Session {
            child,
            stdin,
            stop_reader: Arc::clone(&stop_reader),
        });
    }
    {
        let mut slot = state.root.lock().unwrap_or_else(|e| e.into_inner());
        *slot = Some(root);
    }
    {
        let mut slot = state
            .compile_commands_dir
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        *slot = compile_dir.map(|p| p.to_string_lossy().to_string());
    }
    state.running.store(true, Ordering::SeqCst);

    let pending = Arc::clone(&state.pending);
    let app_reader = app.clone();
    thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        while !stop_reader.load(Ordering::SeqCst) {
            let msg = match read_message(&mut reader) {
                Ok(v) => v,
                Err(_) => break,
            };

            if let Some(id) = msg.get("id").and_then(|v| v.as_u64()) {
                let result = if let Some(err) = msg.get("error") {
                    Err(err.to_string())
                } else {
                    Ok(msg.get("result").cloned().unwrap_or(Value::Null))
                };
                if let Ok(mut map) = pending.lock() {
                    if let Some(p) = map.remove(&id) {
                        let _ = p.tx.send(result);
                    }
                }
                continue;
            }

            if let Some(method) = msg.get("method").and_then(|m| m.as_str()) {
                let params = msg.get("params").cloned().unwrap_or(Value::Null);
                let _ = app_reader.emit(
                    LSP_NOTIFICATION_EVENT,
                    LspNotificationPayload {
                        method: method.to_string(),
                        params,
                    },
                );
            }
        }
    });

    let status = status_payload(&state, None);
    let _ = app.emit(LSP_STATUS_EVENT, status.clone());
    Ok(status)
}

#[tauri::command]
pub fn lsp_stop(app: AppHandle, state: State<'_, LspState>) -> Result<(), String> {
    stop_session(&state);
    let _ = app.emit(LSP_STATUS_EVENT, status_payload(&state, None));
    Ok(())
}

#[tauri::command]
pub fn lsp_status(state: State<'_, LspState>) -> LspStatusPayload {
    status_payload(&state, None)
}

fn with_stdin<F>(state: &LspState, f: F) -> Result<(), String>
where
    F: FnOnce(&mut ChildStdin) -> Result<(), String>,
{
    let mut slot = state.session.lock().unwrap_or_else(|e| e.into_inner());
    let session = slot
        .as_mut()
        .ok_or_else(|| "clangd is not running.".to_string())?;
    f(&mut session.stdin)
}

#[tauri::command]
pub fn lsp_notify(state: State<'_, LspState>, method: String, params: Value) -> Result<(), String> {
    if !state.running.load(Ordering::SeqCst) {
        return Err("clangd is not running.".into());
    }
    let body = json!({
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
    });
    with_stdin(&state, |stdin| write_rpc(stdin, &body))
}

#[tauri::command]
pub fn lsp_request(
    state: State<'_, LspState>,
    method: String,
    params: Value,
) -> Result<Value, String> {
    if !state.running.load(Ordering::SeqCst) {
        return Err("clangd is not running.".into());
    }

    let id = state.next_id.fetch_add(1, Ordering::SeqCst);
    let (tx, rx): (Sender<Result<Value, String>>, Receiver<Result<Value, String>>) = channel();
    {
        let mut pending = state.pending.lock().unwrap_or_else(|e| e.into_inner());
        pending.insert(id, Pending { tx });
    }

    let body = json!({
        "jsonrpc": "2.0",
        "id": id,
        "method": method,
        "params": params,
    });

    if let Err(e) = with_stdin(&state, |stdin| write_rpc(stdin, &body)) {
        let mut pending = state.pending.lock().unwrap_or_else(|e| e.into_inner());
        pending.remove(&id);
        return Err(e);
    }

    match rx.recv_timeout(Duration::from_secs(20)) {
        Ok(result) => result,
        Err(_) => {
            let mut pending = state.pending.lock().unwrap_or_else(|e| e.into_inner());
            pending.remove(&id);
            Err("LSP request timed out.".into())
        }
    }
}

#[tauri::command]
pub fn lsp_path_to_uri(path: String) -> String {
    path_to_uri(&path)
}
