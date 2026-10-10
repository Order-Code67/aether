use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, State};

const DEBUG_EVENT: &str = "debug-event";
const DEBUG_CONSOLE: &str = "debug-console";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DebugStatus {
    pub running: bool,
    pub state: String,
    pub cwd: Option<String>,
    pub env: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DebugConsolePayload {
    pub stream: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DebugEventPayload {
    pub kind: String,
    pub state: String,
    pub file: Option<String>,
    pub line: Option<u32>,
    pub reason: Option<String>,
    pub frames: Option<Value>,
    pub variables: Option<Value>,
    pub error: Option<String>,
}

struct Pending {
    tx: Sender<Result<String, String>>,
}

struct Session {
    child: Child,
    stdin: ChildStdin,
    stop_reader: Arc<AtomicBool>,
}

pub struct DebugState {
    session: Mutex<Option<Session>>,
    next_token: AtomicU64,
    pending: Arc<Mutex<HashMap<u64, Pending>>>,
    running: Arc<AtomicBool>,
    exec_state: Mutex<String>,
    cwd: Mutex<Option<String>>,
    env: Mutex<Option<String>>,
}

impl Default for DebugState {
    fn default() -> Self {
        Self {
            session: Mutex::new(None),
            next_token: AtomicU64::new(1),
            pending: Arc::new(Mutex::new(HashMap::new())),
            running: Arc::new(AtomicBool::new(false)),
            exec_state: Mutex::new("inactive".into()),
            cwd: Mutex::new(None),
            env: Mutex::new(None),
        }
    }
}

fn resolve_pio() -> Option<String> {
    for candidate in ["pio", "platformio", "platformio.exe", "pio.exe"] {
        if let Ok(path) = which::which(candidate) {
            return Some(path.to_string_lossy().to_string());
        }
    }
    if let Ok(home) = std::env::var("USERPROFILE") {
        for name in ["pio.exe", "platformio.exe"] {
            let path = PathBuf::from(&home)
                .join(".platformio")
                .join("penv")
                .join("Scripts")
                .join(name);
            if path.is_file() {
                return Some(path.to_string_lossy().to_string());
            }
        }
    }
    None
}

fn set_exec_state(state: &DebugState, value: &str) {
    if let Ok(mut slot) = state.exec_state.lock() {
        *slot = value.to_string();
    }
}

fn exec_state(state: &DebugState) -> String {
    state
        .exec_state
        .lock()
        .ok()
        .map(|g| g.clone())
        .unwrap_or_else(|| "inactive".into())
}

fn status_of(state: &DebugState, error: Option<String>) -> DebugStatus {
    DebugStatus {
        running: state.running.load(Ordering::SeqCst),
        state: exec_state(state),
        cwd: state.cwd.lock().ok().and_then(|g| g.clone()),
        env: state.env.lock().ok().and_then(|g| g.clone()),
        error,
    }
}

fn emit_console(app: &AppHandle, stream: &str, text: String) {
    let _ = app.emit(
        DEBUG_CONSOLE,
        DebugConsolePayload {
            stream: stream.into(),
            text,
        },
    );
}

fn emit_event(app: &AppHandle, payload: DebugEventPayload) {
    let _ = app.emit(DEBUG_EVENT, payload);
}

fn mi_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 8);
    for ch in s.chars() {
        match ch {
            '\\' => out.push_str("\\\\"),
            '"' => out.push_str("\\\""),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            c => out.push(c),
        }
    }
    out
}

fn write_mi(stdin: &mut ChildStdin, line: &str) -> Result<(), String> {
    stdin
        .write_all(line.as_bytes())
        .and_then(|_| stdin.write_all(b"\n"))
        .and_then(|_| stdin.flush())
        .map_err(|e| format!("Failed to write to debugger: {e}"))
}

fn with_stdin<F>(state: &DebugState, f: F) -> Result<(), String>
where
    F: FnOnce(&mut ChildStdin) -> Result<(), String>,
{
    let mut slot = state.session.lock().unwrap_or_else(|e| e.into_inner());
    let session = slot
        .as_mut()
        .ok_or_else(|| "Debugger is not running.".to_string())?;
    f(&mut session.stdin)
}

fn stop_session(state: &DebugState) {
    state.running.store(false, Ordering::SeqCst);
    set_exec_state(state, "inactive");
    if let Ok(mut slot) = state.session.lock() {
        if let Some(mut session) = slot.take() {
            session.stop_reader.store(true, Ordering::SeqCst);
            let _ = write_mi(&mut session.stdin, "-gdb-exit");
            thread::sleep(Duration::from_millis(80));
            let _ = session.child.kill();
            let _ = session.child.wait();
        }
    }
    if let Ok(mut pending) = state.pending.lock() {
        for (_, p) in pending.drain() {
            let _ = p.tx.send(Err("Debugger stopped.".into()));
        }
    }
    if let Ok(mut cwd) = state.cwd.lock() {
        *cwd = None;
    }
    if let Ok(mut env) = state.env.lock() {
        *env = None;
    }
}

fn extract_c_string<'a>(s: &'a str, key: &str) -> Option<&'a str> {
    let pat = format!("{key}=\"");
    let start = s.find(&pat)? + pat.len();
    let bytes = s.as_bytes();
    let mut i = start;
    let out_start = start;
    // Find closing unescaped quote; return slice (no unescape for paths usually fine)
    while i < bytes.len() {
        if bytes[i] == b'\\' {
            i += 2;
            continue;
        }
        if bytes[i] == b'"' {
            return Some(&s[out_start..i]);
        }
        i += 1;
    }
    None
}

fn extract_u32(s: &str, key: &str) -> Option<u32> {
    if let Some(v) = extract_c_string(s, key) {
        return v.parse().ok();
    }
    let pat2 = format!("{key}=");
    let rest = s.split(&pat2).nth(1)?;
    let num: String = rest
        .chars()
        .take_while(|c| c.is_ascii_digit())
        .collect();
    num.parse().ok()
}

fn parse_stopped(line: &str) -> DebugEventPayload {
    let reason = extract_c_string(line, "reason").map(|s| s.to_string());
    let file = extract_c_string(line, "fullname")
        .or_else(|| extract_c_string(line, "file"))
        .map(|s| s.replace('/', "\\"));
    let line_no = extract_u32(line, "line");
    DebugEventPayload {
        kind: "stopped".into(),
        state: "stopped".into(),
        file,
        line: line_no,
        reason,
        frames: None,
        variables: None,
        error: None,
    }
}

fn handle_mi_line(app: &AppHandle, state_running: &AtomicBool, pending: &Mutex<HashMap<u64, Pending>>, line: &str) {
    if line.is_empty() {
        return;
    }

    // Console / target / log streams
    if let Some(rest) = line.strip_prefix('~') {
        let text = rest.trim_matches('"').replace("\\n", "\n").replace("\\\"", "\"");
        emit_console(app, "console", text);
        return;
    }
    if let Some(rest) = line.strip_prefix('@') {
        let text = rest.trim_matches('"').replace("\\n", "\n");
        emit_console(app, "target", text);
        return;
    }
    if let Some(rest) = line.strip_prefix('&') {
        let text = rest.trim_matches('"').replace("\\n", "\n");
        emit_console(app, "log", text);
        return;
    }

    if line == "(gdb)" || line.ends_with("(gdb)") {
        return;
    }

    // Token-prefixed result: 12^done,...
    let mut token: Option<u64> = None;
    let mut body = line;
    if let Some(idx) = line.find(|c: char| !c.is_ascii_digit()) {
        if idx > 0 {
            if let Ok(t) = line[..idx].parse::<u64>() {
                token = Some(t);
                body = &line[idx..];
            }
        }
    }

    if let Some(rest) = body.strip_prefix('*') {
        if rest.starts_with("stopped") {
            let mut payload = parse_stopped(rest);
            payload.state = "stopped".into();
            emit_event(app, payload);
            emit_console(app, "system", "*stopped\n".into());
        } else if rest.starts_with("running") {
            emit_event(
                app,
                DebugEventPayload {
                    kind: "running".into(),
                    state: "running".into(),
                    file: None,
                    line: None,
                    reason: None,
                    frames: None,
                    variables: None,
                    error: None,
                },
            );
        }
        return;
    }

    if let Some(rest) = body.strip_prefix('^') {
        let ok = rest.starts_with("done") || rest.starts_with("running") || rest.starts_with("exit");
        let err = rest.starts_with("error");
        if let Some(t) = token {
            if let Ok(mut map) = pending.lock() {
                if let Some(p) = map.remove(&t) {
                    if err {
                        let msg = extract_c_string(rest, "msg").unwrap_or("GDB error").to_string();
                        let _ = p.tx.send(Err(msg));
                    } else {
                        let _ = p.tx.send(Ok(rest.to_string()));
                    }
                }
            }
        }
        if rest.starts_with("exit") {
            state_running.store(false, Ordering::SeqCst);
            emit_event(
                app,
                DebugEventPayload {
                    kind: "exited".into(),
                    state: "inactive".into(),
                    file: None,
                    line: None,
                    reason: None,
                    frames: None,
                    variables: None,
                    error: None,
                },
            );
        } else if !ok && err {
            let msg = extract_c_string(rest, "msg").unwrap_or("GDB error");
            emit_console(app, "error", format!("{msg}\n"));
        }
        return;
    }

    // Pass through other lines
    emit_console(app, "mi", format!("{line}\n"));
}

fn mi_request(state: &DebugState, command: &str) -> Result<String, String> {
    if !state.running.load(Ordering::SeqCst) {
        return Err("Debugger is not running.".into());
    }
    let token = state.next_token.fetch_add(1, Ordering::SeqCst);
    let (tx, rx): (Sender<Result<String, String>>, Receiver<Result<String, String>>) = channel();
    {
        let mut pending = state.pending.lock().unwrap_or_else(|e| e.into_inner());
        pending.insert(token, Pending { tx });
    }
    let line = format!("{token}{command}");
    if let Err(e) = with_stdin(state, |stdin| write_mi(stdin, &line)) {
        let mut pending = state.pending.lock().unwrap_or_else(|e| e.into_inner());
        pending.remove(&token);
        return Err(e);
    }
    match rx.recv_timeout(Duration::from_secs(30)) {
        Ok(result) => result,
        Err(_) => {
            let mut pending = state.pending.lock().unwrap_or_else(|e| e.into_inner());
            pending.remove(&token);
            Err("Debugger request timed out.".into())
        }
    }
}

#[tauri::command]
pub fn debug_status(state: State<'_, DebugState>) -> DebugStatus {
    status_of(&state, None)
}

#[tauri::command]
pub fn debug_start(
    app: AppHandle,
    state: State<'_, DebugState>,
    cwd: String,
    env: Option<String>,
) -> Result<DebugStatus, String> {
    if state.running.load(Ordering::SeqCst) {
        return Err("A debug session is already running.".into());
    }

    let pio = resolve_pio().ok_or_else(|| {
        "PlatformIO CLI not found. Install PlatformIO Core and ensure `pio` is on PATH. Debug also needs debug_tool in platformio.ini for the selected env.".to_string()
    })?;

    let root = PathBuf::from(&cwd);
    if !root.is_dir() {
        return Err(format!("Not a directory: {cwd}"));
    }
    if !root.join("platformio.ini").is_file() {
        return Err("No platformio.ini in the workspace root.".into());
    }

    let mut args = vec![
        "debug".into(),
        "--interface".into(),
        "gdb".into(),
        "--interpreter".into(),
        "mi2".into(),
    ];
    if let Some(env_name) = env.clone().filter(|e| !e.is_empty()) {
        args.push("-e".into());
        args.push(env_name);
    }

    emit_console(
        &app,
        "system",
        format!("> {pio} {}\n", args.join(" ")),
    );
    emit_console(&app, "system", format!("cwd: {cwd}\n"));

    let mut child = Command::new(&pio)
        .args(&args)
        .current_dir(&root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            format!(
                "Failed to start debugger: {e}. Ensure PlatformIO is installed and debug_tool is configured for this env."
            )
        })?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Debugger stdout missing".to_string())?;
    let stderr = child.stderr.take();
    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Debugger stdin missing".to_string())?;

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
        let mut slot = state.cwd.lock().unwrap_or_else(|e| e.into_inner());
        *slot = Some(cwd);
    }
    {
        let mut slot = state.env.lock().unwrap_or_else(|e| e.into_inner());
        *slot = env;
    }
    state.running.store(true, Ordering::SeqCst);
    set_exec_state(&state, "starting");

    let pending = Arc::clone(&state.pending);
    let running_flag = Arc::clone(&state.running);
    let app_out = app.clone();
    let stop_out = Arc::clone(&stop_reader);
    thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        let mut buf = String::new();
        while !stop_out.load(Ordering::SeqCst) {
            buf.clear();
            match reader.read_line(&mut buf) {
                Ok(0) => break,
                Ok(_) => {
                    let line = buf.trim_end_matches(['\r', '\n']).to_string();
                    handle_mi_line(&app_out, &running_flag, &pending, &line);
                }
                Err(_) => break,
            }
        }
        let was_running = running_flag.swap(false, Ordering::SeqCst);
        if was_running {
            emit_event(
                &app_out,
                DebugEventPayload {
                    kind: "exited".into(),
                    state: "inactive".into(),
                    file: None,
                    line: None,
                    reason: None,
                    frames: None,
                    variables: None,
                    error: None,
                },
            );
            emit_console(&app_out, "system", "■ Debugger process ended\n".into());
        }
    });

    if let Some(stderr) = stderr {
        let app_err = app.clone();
        let stop_err = Arc::clone(&stop_reader);
        thread::spawn(move || {
            let mut reader = BufReader::new(stderr);
            let mut buf = String::new();
            while !stop_err.load(Ordering::SeqCst) {
                buf.clear();
                match reader.read_line(&mut buf) {
                    Ok(0) => break,
                    Ok(_) => emit_console(&app_err, "stderr", buf.clone()),
                    Err(_) => break,
                }
            }
        });
    }

    set_exec_state(&state, "running");
    emit_event(
        &app,
        DebugEventPayload {
            kind: "started".into(),
            state: "running".into(),
            file: None,
            line: None,
            reason: None,
            frames: None,
            variables: None,
            error: None,
        },
    );

    Ok(status_of(&state, None))
}

#[tauri::command]
pub fn debug_stop(app: AppHandle, state: State<'_, DebugState>) -> Result<(), String> {
    stop_session(&state);
    emit_event(
        &app,
        DebugEventPayload {
            kind: "exited".into(),
            state: "inactive".into(),
            file: None,
            line: None,
            reason: None,
            frames: None,
            variables: None,
            error: None,
        },
    );
    emit_console(&app, "system", "■ Debug session stopped\n".into());
    Ok(())
}

#[tauri::command]
pub fn debug_continue(state: State<'_, DebugState>) -> Result<(), String> {
    mi_request(&state, "-exec-continue")?;
    set_exec_state(&state, "running");
    Ok(())
}

#[tauri::command]
pub fn debug_pause(state: State<'_, DebugState>) -> Result<(), String> {
    // Interrupt running target
    let _ = mi_request(&state, "-exec-interrupt");
    Ok(())
}

#[tauri::command]
pub fn debug_step_over(state: State<'_, DebugState>) -> Result<(), String> {
    mi_request(&state, "-exec-next")?;
    set_exec_state(&state, "running");
    Ok(())
}

#[tauri::command]
pub fn debug_step_into(state: State<'_, DebugState>) -> Result<(), String> {
    mi_request(&state, "-exec-step")?;
    set_exec_state(&state, "running");
    Ok(())
}

#[tauri::command]
pub fn debug_step_out(state: State<'_, DebugState>) -> Result<(), String> {
    mi_request(&state, "-exec-finish")?;
    set_exec_state(&state, "running");
    Ok(())
}

#[tauri::command]
pub fn debug_insert_breakpoint(
    state: State<'_, DebugState>,
    path: String,
    line: u32,
) -> Result<Value, String> {
    let unix = path.replace('\\', "/");
    let cmd = format!(
        "-break-insert -f \"{}:{}\"",
        mi_escape(&unix),
        line
    );
    let result = mi_request(&state, &cmd)?;
    // Parse bkpt number if present
    let number = extract_c_string(&result, "number")
        .or_else(|| {
            result
                .split("number=\"")
                .nth(1)
                .and_then(|s| s.split('"').next())
        })
        .map(|s| s.to_string());
    Ok(json!({ "raw": result, "number": number }))
}

#[tauri::command]
pub fn debug_delete_breakpoint(
    state: State<'_, DebugState>,
    number: String,
) -> Result<(), String> {
    let cmd = format!("-break-delete {number}");
    let _ = mi_request(&state, &cmd)?;
    Ok(())
}

#[tauri::command]
pub fn debug_stack(state: State<'_, DebugState>) -> Result<Value, String> {
    let result = mi_request(&state, "-stack-list-frames")?;
    // Very light parse: return raw + best-effort frames array
    let mut frames = Vec::new();
    for part in result.split("frame={").skip(1) {
        let chunk = part.split('}').next().unwrap_or("");
        let level = extract_c_string(chunk, "level")
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(0);
        let file = extract_c_string(chunk, "fullname")
            .or_else(|| extract_c_string(chunk, "file"))
            .map(|s| s.replace('/', "\\"));
        let line = extract_u32(chunk, "line");
        let func = extract_c_string(chunk, "func").map(|s| s.to_string());
        frames.push(json!({
            "level": level,
            "file": file,
            "line": line,
            "function": func,
        }));
    }
    Ok(json!({ "frames": frames, "raw": result }))
}

#[tauri::command]
pub fn debug_variables(state: State<'_, DebugState>) -> Result<Value, String> {
    let result = mi_request(&state, "-stack-list-variables --skip-unavailable 1")?;
    let mut vars = Vec::new();
    for part in result.split('{').skip(1) {
        let chunk = part.split('}').next().unwrap_or("");
        if let Some(name) = extract_c_string(chunk, "name") {
            let value = extract_c_string(chunk, "value").unwrap_or("");
            vars.push(json!({ "name": name, "value": value }));
        }
    }
    Ok(json!({ "variables": vars, "raw": result }))
}

#[tauri::command]
pub fn debug_eval(state: State<'_, DebugState>, expression: String) -> Result<String, String> {
    let cmd = format!("-data-evaluate-expression \"{}\"", mi_escape(&expression));
    let result = mi_request(&state, &cmd)?;
    Ok(extract_c_string(&result, "value")
        .unwrap_or(&result)
        .to_string())
}

#[tauri::command]
pub fn debug_console_input(state: State<'_, DebugState>, command: String) -> Result<(), String> {
    let cmd = command.trim();
    if cmd.is_empty() {
        return Ok(());
    }
    // Allow raw MI or wrap CLI via interpreter-exec
    if cmd.starts_with('-') {
        let _ = mi_request(&state, cmd)?;
    } else {
        let wrapped = format!(
            "-interpreter-exec console \"{}\"",
            mi_escape(cmd)
        );
        let _ = mi_request(&state, &wrapped)?;
    }
    Ok(())
}
