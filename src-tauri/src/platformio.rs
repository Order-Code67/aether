use std::fs::{self, File};
use std::io::{BufRead, BufReader, Read};
use std::path::{Component, Path, PathBuf};
use std::process::{Child, Command, Output, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use zip::ZipArchive;

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
pub struct PythonInfo {
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

    let mut homes: Vec<PathBuf> = Vec::new();
    for key in ["USERPROFILE", "HOME"] {
        if let Ok(home) = std::env::var(key) {
            homes.push(PathBuf::from(home));
        }
    }

    for home in homes {
        let candidates = [
            home.join(".platformio")
                .join("penv")
                .join("Scripts")
                .join("pio.exe"),
            home.join(".platformio")
                .join("penv")
                .join("Scripts")
                .join("platformio.exe"),
            home.join(".platformio").join("penv").join("bin").join("pio"),
            home.join(".platformio")
                .join("penv")
                .join("bin")
                .join("platformio"),
        ];
        for path in candidates {
            if path.is_file() {
                return Some(path.to_string_lossy().to_string());
            }
        }
    }

    None
}

/// Configure a PlatformIO subprocess for GUI/WebView hosts (Windows).
fn configure_pio_command(cmd: &mut Command) {
    cmd.env("PYTHONUTF8", "1");
    cmd.env("PYTHONIOENCODING", "utf-8");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
}

fn run_pio(
    command: &str,
    args: &[String],
    cwd: Option<&Path>,
) -> Result<Output, String> {
    let mut cmd = Command::new(command);
    cmd.args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }
    configure_pio_command(&mut cmd);
    cmd.output()
        .map_err(|e| format!("Failed to run PlatformIO ({command}): {e}"))
}

/// Run PlatformIO with a hard wall-clock timeout; kill the child on expiry.
/// Used for registry-bound commands so offline DNS hangs cannot freeze the UI.
fn run_pio_with_timeout(
    command: &str,
    args: &[String],
    cwd: Option<&Path>,
    timeout: Duration,
) -> Result<Output, String> {
    let mut cmd = Command::new(command);
    cmd.args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }
    configure_pio_command(&mut cmd);
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to run PlatformIO ({command}): {e}"))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let stdout_handle = thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(mut out) = stdout {
            let _ = out.read_to_end(&mut buf);
        }
        buf
    });
    let stderr_handle = thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(mut err) = stderr {
            let _ = err.read_to_end(&mut buf);
        }
        buf
    });

    let started = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let stdout = stdout_handle.join().unwrap_or_default();
                let stderr = stderr_handle.join().unwrap_or_default();
                return Ok(Output {
                    status,
                    stdout,
                    stderr,
                });
            }
            Ok(None) => {
                if started.elapsed() >= timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    let _ = stdout_handle.join();
                    let _ = stderr_handle.join();
                    return Err(format!(
                        "PlatformIO timed out after {}s (offline or slow registry?).",
                        timeout.as_secs()
                    ));
                }
                thread::sleep(Duration::from_millis(40));
            }
            Err(e) => {
                let _ = child.kill();
                return Err(format!("Failed to wait for PlatformIO: {e}"));
            }
        }
    }
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

    let mut version_cmd = Command::new(&command);
    version_cmd
        .arg("--version")
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    configure_pio_command(&mut version_cmd);
    let version = version_cmd
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

fn resolve_python_command() -> Option<String> {
    for candidate in ["python", "python3", "py"] {
        if let Ok(path) = which::which(candidate) {
            return Some(path.to_string_lossy().to_string());
        }
    }
    None
}

fn python_version(command: &str) -> Option<String> {
    let mut cmd = Command::new(command);
    // `py -3` needs a version flag; plain `python --version` works for python/python3.
    if command.ends_with("py.exe") || command.ends_with("\\py") || command.ends_with("/py") {
        cmd.args(["-3", "--version"]);
    } else {
        cmd.arg("--version");
    }
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    configure_pio_command(&mut cmd);
    let out = cmd.output().ok()?;
    let mut text = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if text.is_empty() {
        text = String::from_utf8_lossy(&out.stderr).trim().to_string();
    }
    if text.is_empty() {
        None
    } else {
        Some(text)
    }
}

/// Detect a usable Python for `pip install platformio` (optional helper for Doctor).
#[tauri::command]
pub fn python_detect() -> PythonInfo {
    let Some(command) = resolve_python_command() else {
        return PythonInfo {
            installed: false,
            command: None,
            version: None,
        };
    };
    let version = python_version(&command);
    PythonInfo {
        installed: version.is_some(),
        command: Some(command),
        version,
    }
}

/// Spawn a long-running process and stream stdout/stderr via pio-output / pio-status.
fn spawn_streaming_task(
    app: AppHandle,
    state: &PioState,
    program: String,
    args: Vec<String>,
    cwd: Option<PathBuf>,
    task: String,
) -> Result<(), String> {
    if state.running.load(Ordering::SeqCst) {
        return Err("A PlatformIO task is already running.".into());
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

    emit_line(&app, "system", format!("> {program} {}", args.join(" ")));
    if let Some(ref dir) = cwd {
        emit_line(&app, "system", format!("cwd: {}", dir.display()));
    }

    let mut child_cmd = Command::new(&program);
    child_cmd
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null());
    if let Some(ref dir) = cwd {
        child_cmd.current_dir(dir);
    }
    configure_pio_command(&mut child_cmd);
    let mut child = child_cmd.spawn().map_err(|e| {
        state.running.store(false, Ordering::SeqCst);
        format!("Failed to start process: {e}")
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
    let task_name = task;

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

            thread::sleep(std::time::Duration::from_millis(50));
        };

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

/// Non-interactive PlatformIO Core install via `python -m pip install -U platformio`.
/// Does not download board toolchains (those install on first project build).
#[tauri::command]
pub fn pio_install_core(app: AppHandle, state: State<'_, PioState>) -> Result<(), String> {
    if resolve_pio_command().is_some() {
        emit_line(
            &app,
            "system",
            "PlatformIO CLI already found — skipping install.".into(),
        );
        emit_status(
            &app,
            PioStatusPayload {
                running: false,
                task: Some("install-core".into()),
                success: Some(true),
                code: Some(0),
                error: None,
            },
        );
        return Ok(());
    }

    let python = resolve_python_command().ok_or_else(|| {
        "Python not found. Install Python 3 from python.org, enable pip, then retry.".to_string()
    })?;

    let mut args = Vec::new();
    if python.ends_with("py.exe") || python.ends_with("\\py") || python.ends_with("/py") {
        args.push("-3".into());
    }
    args.extend([
        "-m".into(),
        "pip".into(),
        "install".into(),
        "-U".into(),
        "platformio".into(),
    ]);

    spawn_streaming_task(
        app,
        &*state,
        python,
        args,
        None,
        "install-core".into(),
    )
}

/// Open Windows Optional Features (driver / COM stack hints). No-op message on other OS.
#[tauri::command]
pub fn open_windows_optional_features() -> Result<(), String> {
    #[cfg(windows)]
    {
        Command::new("cmd")
            .args(["/C", "start", "", "ms-settings:optionalfeatures"])
            .spawn()
            .map_err(|e| format!("Failed to open Optional Features: {e}"))?;
        return Ok(());
    }
    #[cfg(not(windows))]
    {
        Err("Optional Features is only available on Windows.".into())
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
    upload_port: Option<String>,
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

    if task == "upload" {
        if let Some(port) = upload_port
            .as_deref()
            .map(str::trim)
            .filter(|p| !p.is_empty())
        {
            if port.contains('\0') || port.len() > 260 {
                return Err("Invalid upload port.".into());
            }
            args.push("--upload-port".into());
            args.push(port.to_string());
        }
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

    let mut child_cmd = Command::new(&command);
    child_cmd
        .args(&args)
        .current_dir(&cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null());
    configure_pio_command(&mut child_cmd);
    let mut child = child_cmd.spawn().map_err(|e| {
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

fn platform_for_board(board: &str) -> &'static str {
    match board {
        "esp32dev"
        | "esp32-s3-devkitc-1"
        | "esp32doit-devkit-v1"
        | "esp32-c3-devkitm-1"
        | "heltec_wifi_lora_32_V2"
        | "heltec_wifi_lora_32_V3"
        | "ttgo-lora32-v1"
        | "ttgo-lora32-v2"
        | "ttgo-t-beam" => "espressif32",
        "esp8266" | "nodemcuv2" | "d1_mini" => "espressif8266",
        "uno" | "nanoatmega328" | "megaatmega2560" | "leonardo" | "micro" => "atmelavr",
        "teensy41" | "teensy40" | "teensy36" => "teensy",
        "pico" | "pico2" => "raspberrypi",
        _ if board.starts_with("esp32") => "espressif32",
        _ if board.starts_with("heltec") || board.starts_with("ttgo") => "espressif32",
        _ if board.starts_with("esp8266") => "espressif8266",
        _ => "atmelavr",
    }
}

fn is_esp32_family(board: &str) -> bool {
    board.starts_with("esp32")
        || board.starts_with("heltec")
        || board.starts_with("ttgo")
        || matches!(board, "esp32dev" | "esp32doit-devkit-v1")
}

fn validate_framework(framework: &str) -> Result<&str, String> {
    let fw = framework.trim();
    if fw.is_empty() {
        return Ok("arduino");
    }
    if fw == "arduino" {
        return Ok(fw);
    }
    Err("Only the Arduino framework is supported in the project wizard.".into())
}

fn validate_starter(starter: &str) -> Result<&str, String> {
    let s = starter.trim();
    if s.is_empty()
        || matches!(
            s,
            "none" | "blink" | "servo" | "lora_tx" | "lora_rx" | "lorawan" | "espnow"
        )
    {
        return Ok(if s.is_empty() { "none" } else { s });
    }
    Err("Invalid starter template.".into())
}

fn validate_region(region: &str) -> Result<&str, String> {
    let r = region.trim();
    if r.is_empty() || r == "EU868" || r == "US915" || r == "RU864" {
        return Ok(if r.is_empty() { "EU868" } else { r });
    }
    Err("Invalid LoRa region (use EU868, US915, or RU864).".into())
}

fn region_freq_mhz(region: &str) -> &'static str {
    match region {
        "US915" => "915.0",
        "RU864" => "864.1",
        _ => "868.1",
    }
}

fn lora_pin_build_flags(board: &str) -> String {
    let flags = match board {
        "heltec_wifi_lora_32_V3" => "\
\t-DAETHER_LORA_NSS=8\n\
\t-DAETHER_LORA_DIO=14\n\
\t-DAETHER_LORA_RST=12\n\
\t-DAETHER_LORA_BUSY=13\n\
\t-DAETHER_LORA_SCK=9\n\
\t-DAETHER_LORA_MISO=11\n\
\t-DAETHER_LORA_MOSI=10\n\
\t-DAETHER_OLED_SDA=17\n\
\t-DAETHER_OLED_SCL=18\n\
\t-DAETHER_OLED_RST=21\n\
\t-DAETHER_RADIO_SX126X=1\n",
        "heltec_wifi_lora_32_V2" => "\
\t-DAETHER_LORA_NSS=18\n\
\t-DAETHER_LORA_DIO=26\n\
\t-DAETHER_LORA_RST=14\n\
\t-DAETHER_LORA_BUSY=-1\n\
\t-DAETHER_LORA_SCK=5\n\
\t-DAETHER_LORA_MISO=19\n\
\t-DAETHER_LORA_MOSI=27\n\
\t-DAETHER_OLED_SDA=4\n\
\t-DAETHER_OLED_SCL=15\n\
\t-DAETHER_OLED_RST=16\n\
\t-DAETHER_RADIO_SX127X=1\n",
        "ttgo-lora32-v1" | "ttgo-lora32-v2" => "\
\t-DAETHER_LORA_NSS=18\n\
\t-DAETHER_LORA_DIO=26\n\
\t-DAETHER_LORA_RST=14\n\
\t-DAETHER_LORA_BUSY=-1\n\
\t-DAETHER_LORA_SCK=5\n\
\t-DAETHER_LORA_MISO=19\n\
\t-DAETHER_LORA_MOSI=27\n\
\t-DAETHER_OLED_SDA=21\n\
\t-DAETHER_OLED_SCL=22\n\
\t-DAETHER_RADIO_SX127X=1\n",
        "ttgo-t-beam" => "\
\t-DAETHER_LORA_NSS=18\n\
\t-DAETHER_LORA_DIO=26\n\
\t-DAETHER_LORA_RST=23\n\
\t-DAETHER_LORA_BUSY=-1\n\
\t-DAETHER_LORA_SCK=5\n\
\t-DAETHER_LORA_MISO=19\n\
\t-DAETHER_LORA_MOSI=27\n\
\t-DAETHER_OLED_SDA=21\n\
\t-DAETHER_OLED_SCL=22\n\
\t-DAETHER_RADIO_SX127X=1\n",
        "megaatmega2560" => "\
\t-DAETHER_LORA_NSS=10\n\
\t-DAETHER_LORA_DIO=2\n\
\t-DAETHER_LORA_RST=9\n\
\t-DAETHER_LORA_BUSY=-1\n\
\t-DAETHER_RADIO_SX127X=1\n",
        _ => "\
\t-DAETHER_LORA_NSS=5\n\
\t-DAETHER_LORA_DIO=26\n\
\t-DAETHER_LORA_RST=14\n\
\t-DAETHER_LORA_BUSY=-1\n\
\t-DAETHER_LORA_SCK=18\n\
\t-DAETHER_LORA_MISO=19\n\
\t-DAETHER_LORA_MOSI=23\n\
\t-DAETHER_RADIO_SX127X=1\n",
    };
    flags.to_string()
}

fn write_wizard_project_files(
    project_dir: &Path,
    board: &str,
    framework: &str,
    starter: &str,
    region: &str,
) -> Result<(), String> {
    let platform = platform_for_board(board);
    let env_name = board;
    let freq = region_freq_mhz(region);
    let is_lora = matches!(starter, "lora_tx" | "lora_rx" | "lorawan");
    let mut lib_deps = String::new();
    let mut build_flags = String::new();

    if starter == "servo" {
        if is_esp32_family(board) {
            lib_deps.push_str("lib_deps =\n\tmadhephaestus/ESP32Servo@^3.0.6\n");
        } else {
            lib_deps.push_str("lib_deps =\n\tarduino-libraries/Servo@^1.2.2\n");
        }
    } else if is_lora {
        lib_deps.push_str(
            "lib_deps =\n\
\tjgromes/RadioLib\n\
\tbblanchon/ArduinoJson\n\
\tadafruit/Adafruit GFX Library\n\
\tadafruit/Adafruit SSD1306\n\
\tadafruit/Adafruit BusIO\n\
\tolikraus/U8g2\n",
        );
        if starter == "lorawan" {
            lib_deps.push_str("\tmcci-catena/MCCI LoRaWAN LMIC library\n");
        }
        build_flags.push_str("build_flags =\n");
        build_flags.push_str(&format!("\t-DAETHER_LORA_REGION_{region}\n"));
        build_flags.push_str(&format!("\t-DAETHER_LORA_FREQ={freq}\n"));
        build_flags.push_str("\t-DAETHER_LORA_SF=7\n");
        build_flags.push_str("\t-DAETHER_LORA_BW=125.0\n");
        build_flags.push_str(&lora_pin_build_flags(board));
        if starter == "lorawan" {
            let cfg = match region {
                "US915" => "CFG_us915",
                "RU864" => "CFG_ru864",
                _ => "CFG_eu868",
            };
            build_flags.push_str(&format!("\t-D{cfg}=1\n"));
        }
    } else if starter == "espnow" {
        lib_deps.push_str("lib_deps =\n\tbblanchon/ArduinoJson\n");
    }

    let ini = format!(
        "; PlatformIO Project Configuration File\n\
         ; Created by Aether project wizard\n\n\
         [env:{env_name}]\n\
         platform = {platform}\n\
         board = {board}\n\
         framework = {framework}\n\
         monitor_speed = 115200\n\
         {lib_deps}{build_flags}"
    );

    let main_cpp = match starter {
        "servo" if is_esp32_family(board) => {
            r#"#include <Arduino.h>
#include <ESP32Servo.h>

#ifndef SERVO_PIN
#define SERVO_PIN 13
#endif

Servo servo;

void setup() {
  Serial.begin(115200);
  servo.attach(SERVO_PIN);
  servo.write(90);
  Serial.println("Aether servo sketch ready");
}

void loop() {
  static int angle = 0;
  static int step = 1;
  servo.write(angle);
  angle += step;
  if (angle >= 180 || angle <= 0) {
    step = -step;
  }
  delay(20);
}
"#
        }
        "servo" => {
            r#"#include <Arduino.h>
#include <Servo.h>

#ifndef SERVO_PIN
#define SERVO_PIN 9
#endif

Servo servo;

void setup() {
  Serial.begin(115200);
  servo.attach(SERVO_PIN);
  servo.write(90);
  Serial.println("Aether servo sketch ready");
}

void loop() {
  static int angle = 0;
  static int step = 1;
  servo.write(angle);
  angle += step;
  if (angle >= 180 || angle <= 0) {
    step = -step;
  }
  delay(20);
}
"#
        }
        "blink" if is_esp32_family(board) => {
            r#"#include <Arduino.h>

#ifndef LED_BUILTIN
#define LED_BUILTIN 2
#endif

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(115200);
  Serial.println("Aether blink sketch ready");
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  delay(500);
}
"#
        }
        "blink" => {
            r#"#include <Arduino.h>

#ifndef LED_BUILTIN
#define LED_BUILTIN 13
#endif

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(115200);
  Serial.println("Aether blink sketch ready");
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  delay(500);
}
"#
        }
        "lora_tx" => {
            r#"#include <Arduino.h>
#include <RadioLib.h>
#include <SPI.h>

#ifndef AETHER_LORA_NSS
#define AETHER_LORA_NSS 5
#endif
#ifndef AETHER_LORA_DIO
#define AETHER_LORA_DIO 26
#endif
#ifndef AETHER_LORA_RST
#define AETHER_LORA_RST 14
#endif
#ifndef AETHER_LORA_BUSY
#define AETHER_LORA_BUSY -1
#endif
#ifndef AETHER_LORA_SCK
#define AETHER_LORA_SCK 18
#endif
#ifndef AETHER_LORA_MISO
#define AETHER_LORA_MISO 19
#endif
#ifndef AETHER_LORA_MOSI
#define AETHER_LORA_MOSI 23
#endif
#ifndef AETHER_LORA_FREQ
#define AETHER_LORA_FREQ 868.1
#endif
#ifndef AETHER_LORA_SF
#define AETHER_LORA_SF 7
#endif
#ifndef AETHER_LORA_BW
#define AETHER_LORA_BW 125.0
#endif

#if defined(AETHER_RADIO_SX126X)
SX1262 radio = new Module(AETHER_LORA_NSS, AETHER_LORA_DIO, AETHER_LORA_RST, AETHER_LORA_BUSY);
#else
SX1276 radio = new Module(AETHER_LORA_NSS, AETHER_LORA_DIO, AETHER_LORA_RST, AETHER_LORA_BUSY);
#endif

uint32_t counter = 0;

void setup() {
  Serial.begin(115200);
  delay(200);
#if defined(ESP32)
  SPI.begin(AETHER_LORA_SCK, AETHER_LORA_MISO, AETHER_LORA_MOSI, AETHER_LORA_NSS);
#endif
  Serial.printf("Aether LoRa TX freq=%.1f SF=%d\n", (double)AETHER_LORA_FREQ, AETHER_LORA_SF);
  int state = radio.begin(AETHER_LORA_FREQ);
  if (state != RADIOLIB_ERR_NONE) {
    Serial.printf("Radio init failed: %d — check SPI/NSS/RST/DIO + antenna\n", state);
    while (true) delay(1000);
  }
  radio.setSpreadingFactor(AETHER_LORA_SF);
  radio.setBandwidth(AETHER_LORA_BW);
}

void loop() {
  String msg = "aether#" + String(counter++);
  int state = radio.transmit(msg);
  if (state == RADIOLIB_ERR_NONE) {
    Serial.printf("TX OK: %s\n", msg.c_str());
  } else {
    Serial.printf("TX fail: %d\n", state);
  }
  delay(2000);
}
"#
        }
        "lora_rx" => {
            r#"#include <Arduino.h>
#include <RadioLib.h>
#include <SPI.h>

#ifndef AETHER_LORA_NSS
#define AETHER_LORA_NSS 5
#endif
#ifndef AETHER_LORA_DIO
#define AETHER_LORA_DIO 26
#endif
#ifndef AETHER_LORA_RST
#define AETHER_LORA_RST 14
#endif
#ifndef AETHER_LORA_BUSY
#define AETHER_LORA_BUSY -1
#endif
#ifndef AETHER_LORA_SCK
#define AETHER_LORA_SCK 18
#endif
#ifndef AETHER_LORA_MISO
#define AETHER_LORA_MISO 19
#endif
#ifndef AETHER_LORA_MOSI
#define AETHER_LORA_MOSI 23
#endif
#ifndef AETHER_LORA_FREQ
#define AETHER_LORA_FREQ 868.1
#endif
#ifndef AETHER_LORA_SF
#define AETHER_LORA_SF 7
#endif
#ifndef AETHER_LORA_BW
#define AETHER_LORA_BW 125.0
#endif

#if defined(AETHER_RADIO_SX126X)
SX1262 radio = new Module(AETHER_LORA_NSS, AETHER_LORA_DIO, AETHER_LORA_RST, AETHER_LORA_BUSY);
#else
SX1276 radio = new Module(AETHER_LORA_NSS, AETHER_LORA_DIO, AETHER_LORA_RST, AETHER_LORA_BUSY);
#endif

void setup() {
  Serial.begin(115200);
  delay(200);
#if defined(ESP32)
  SPI.begin(AETHER_LORA_SCK, AETHER_LORA_MISO, AETHER_LORA_MOSI, AETHER_LORA_NSS);
#endif
  Serial.printf("Aether LoRa RX freq=%.1f SF=%d\n", (double)AETHER_LORA_FREQ, AETHER_LORA_SF);
  int state = radio.begin(AETHER_LORA_FREQ);
  if (state != RADIOLIB_ERR_NONE) {
    Serial.printf("Radio init failed: %d — check SPI/NSS/RST/DIO + antenna\n", state);
    while (true) delay(1000);
  }
  radio.setSpreadingFactor(AETHER_LORA_SF);
  radio.setBandwidth(AETHER_LORA_BW);
  Serial.println("Waiting for packets…");
}

void loop() {
  String str;
  int state = radio.receive(str);
  if (state == RADIOLIB_ERR_NONE) {
    Serial.printf("RX: %s RSSI=%.1f SNR=%.1f\n", str.c_str(), radio.getRSSI(), radio.getSNR());
  } else if (state != RADIOLIB_ERR_RX_TIMEOUT) {
    Serial.printf("RX error: %d\n", state);
  }
}
"#
        }
        "lorawan" => {
            r#"#include <Arduino.h>
#include <RadioLib.h>
#include <SPI.h>

// Wizard LoRaWAN OTAA — set DevEUI + AppKey, then Join + uplink.
// Prefer File → Examples → LoRaWAN OTAA for full multi-board pin maps.

#ifndef AETHER_LORA_NSS
#define AETHER_LORA_NSS 8
#endif
#ifndef AETHER_LORA_DIO
#define AETHER_LORA_DIO 14
#endif
#ifndef AETHER_LORA_RST
#define AETHER_LORA_RST 12
#endif
#ifndef AETHER_LORA_BUSY
#define AETHER_LORA_BUSY 13
#endif
#ifndef AETHER_LORA_SCK
#define AETHER_LORA_SCK 9
#endif
#ifndef AETHER_LORA_MISO
#define AETHER_LORA_MISO 11
#endif
#ifndef AETHER_LORA_MOSI
#define AETHER_LORA_MOSI 10
#endif

#ifndef RADIOLIB_LORAWAN_JOIN_EUI
#define RADIOLIB_LORAWAN_JOIN_EUI 0x0000000000000000ULL
#endif
#ifndef RADIOLIB_LORAWAN_DEV_EUI
#define RADIOLIB_LORAWAN_DEV_EUI 0x0000000000000000ULL
#endif

uint8_t appKey[] = {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0};
uint8_t nwkKey[] = {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0};
uint64_t joinEUI = RADIOLIB_LORAWAN_JOIN_EUI;
uint64_t devEUI = RADIOLIB_LORAWAN_DEV_EUI;
const uint32_t uplinkIntervalSeconds = 300;

#if defined(AETHER_RADIO_SX126X)
SX1262 radio = new Module(AETHER_LORA_NSS, AETHER_LORA_DIO, AETHER_LORA_RST, AETHER_LORA_BUSY);
#else
SX1276 radio = new Module(AETHER_LORA_NSS, AETHER_LORA_DIO, AETHER_LORA_RST, AETHER_LORA_BUSY);
#endif

#if defined(AETHER_LORA_REGION_US915)
LoRaWANNode node(&radio, &US915, 2);
#else
LoRaWANNode node(&radio, &EU868, 0);
#endif

void setup() {
  Serial.begin(115200);
  delay(400);
  Serial.println("Aether LoRaWAN OTAA wizard");
  Serial.printf("DevEUI=%016llX — set keys in main.cpp before Join\n", (unsigned long long)devEUI);
  if (devEUI == 0) {
    Serial.println("Fill DevEUI + AppKey/NwkKey, rebuild, upload.");
    while (true) delay(1000);
  }
  SPI.begin(AETHER_LORA_SCK, AETHER_LORA_MISO, AETHER_LORA_MOSI, AETHER_LORA_NSS);
  int st = radio.begin();
  if (st != RADIOLIB_ERR_NONE) { Serial.printf("radio.begin %d\n", st); while (true) delay(1000); }
  st = node.beginOTAA(joinEUI, devEUI, nwkKey, appKey);
  if (st != RADIOLIB_ERR_NONE) { Serial.printf("beginOTAA %d\n", st); while (true) delay(1000); }
  Serial.println("Joining…");
  st = node.activateOTAA();
  if (st != RADIOLIB_LORAWAN_NEW_SESSION && st != RADIOLIB_LORAWAN_SESSION_RESTORED) {
    Serial.printf("Join failed %d\n", st);
    while (true) delay(1000);
  }
  Serial.println("Joined — uplink loop");
}

void loop() {
  uint8_t payload[3] = { (uint8_t)radio.random(100), 0x12, 0x34 };
  int16_t st = node.sendReceive(payload, sizeof(payload));
  Serial.printf("uplink state=%d\n", st);
  delay(uplinkIntervalSeconds * 1000UL);
}
"#
        }
        "espnow" => {
            r#"#include <Arduino.h>
#include <WiFi.h>
#include <esp_now.h>
#include <ArduinoJson.h>

uint8_t PEER_MAC[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

void onRecv(const uint8_t *mac, const uint8_t *data, int len) {
  Serial.printf("ESP-NOW RX %d bytes\n", len);
  Serial.write(data, len);
  Serial.println();
  (void)mac;
}

void setup() {
  Serial.begin(115200);
  delay(200);
  WiFi.mode(WIFI_STA);
  Serial.print("This MAC: ");
  Serial.println(WiFi.macAddress());
  if (esp_now_init() != ESP_OK) {
    Serial.println("esp_now_init failed");
    return;
  }
  esp_now_register_recv_cb(onRecv);
  esp_now_peer_info_t peer{};
  memcpy(peer.peer_addr, PEER_MAC, 6);
  peer.channel = 0;
  peer.encrypt = false;
  esp_now_add_peer(&peer);
}

void loop() {
  JsonDocument doc;
  doc["from"] = "aether";
  doc["ms"] = millis();
  char buf[128];
  size_t n = serializeJson(doc, buf, sizeof(buf));
  esp_now_send(PEER_MAC, reinterpret_cast<uint8_t *>(buf), n);
  delay(2000);
}
"#
        }
        _ => {
            r#"#include <Arduino.h>

void setup() {
  Serial.begin(115200);
}

void loop() {
}
"#
        }
    };

    let src_dir = project_dir.join("src");
    std::fs::create_dir_all(&src_dir).map_err(|e| e.to_string())?;
    std::fs::write(project_dir.join("platformio.ini"), ini).map_err(|e| e.to_string())?;
    std::fs::write(src_dir.join("main.cpp"), main_cpp).map_err(|e| e.to_string())?;
    Ok(())
}

/// Create a new PlatformIO project via `pio project init`, then apply wizard files.
#[tauri::command]
pub fn pio_project_init(
    parent: String,
    name: String,
    board: String,
    framework: Option<String>,
    starter: Option<String>,
    region: Option<String>,
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

    let framework = validate_framework(framework.as_deref().unwrap_or("arduino"))?;
    let starter = validate_starter(starter.as_deref().unwrap_or("none"))?;
    let region = validate_region(region.as_deref().unwrap_or("EU868"))?;

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

    let init_args = vec![
        "project".into(),
        "init".into(),
        "--board".into(),
        board.to_string(),
        "--project-dir".into(),
        project_dir.to_string_lossy().to_string(),
        "--project-option".into(),
        format!("framework={framework}"),
    ];

    let output = run_pio(&command, &init_args, None)
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

    if let Err(err) = write_wizard_project_files(&project_dir, board, framework, starter, region) {
        let _ = std::fs::remove_dir_all(&project_dir);
        return Err(err);
    }

    Ok(project_dir.to_string_lossy().to_string())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PioLibEntry {
    pub id: String,
    pub name: String,
    pub owner: String,
    pub description: String,
    pub version: String,
    pub platforms: Vec<String>,
}

fn validate_lib_spec(library: &str) -> Result<&str, String> {
    let lib = library.trim();
    if lib.is_empty() || lib.len() > 400 {
        return Err("Invalid library id.".into());
    }
    if lib.contains("..") || lib.contains('\\') || lib.contains('\0') {
        return Err("Invalid library id.".into());
    }
    // Reject shell / path injection characters in specs.
    if lib.chars().any(|c| {
        matches!(
            c,
            ';' | '|' | '&' | '`' | '$' | '\n' | '\r' | '<' | '>' | '"' | '\''
        )
    }) {
        return Err("Invalid library id.".into());
    }
    // Git specs: only https://github.com/... (+ optional #ref) or registry ids.
    if lib.contains("://") {
        let (base, _ref) = lib
            .split_once('#')
            .map(|(b, r)| (b, Some(r)))
            .unwrap_or((lib, None));
        let ok = base.starts_with("https://github.com/")
            && base.len() > "https://github.com/".len()
            && !base[("https://github.com/".len())..].contains("://");
        if !ok {
            return Err(
                "Only https://github.com/… git library URLs are allowed.".into(),
            );
        }
        if let Some(r) = _ref {
            if r.is_empty()
                || r.len() > 120
                || !r
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '.' | '/' | '~' | '+' | '-'))
            {
                return Err("Invalid git library branch/tag.".into());
            }
        }
    }
    Ok(lib)
}

fn validate_env_name(env: &Option<String>) -> Result<Option<&str>, String> {
    let Some(raw) = env.as_ref() else {
        return Ok(None);
    };
    let name = raw.trim();
    if name.is_empty() {
        return Ok(None);
    }
    if name.len() > 64
        || !name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == '.')
    {
        return Err("Invalid environment name.".into());
    }
    Ok(Some(name))
}

fn command_failure_detail(output: &std::process::Output, fallback: &str) -> String {
    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    if !stderr.trim().is_empty() {
        stderr.trim().to_string()
    } else if !stdout.trim().is_empty() {
        stdout.trim().to_string()
    } else {
        fallback.to_string()
    }
}

/// Search PlatformIO registry for libraries.
/// Uses `pio lib search --json-output` (supports `--platform` / `--framework`).
/// Falls back to parsing `pio pkg search` text when JSON search is unavailable.
#[tauri::command]
pub fn pio_lib_search(
    query: String,
    platform: Option<String>,
    framework: Option<String>,
    pages: Option<u32>,
) -> Result<Vec<PioLibEntry>, String> {
    let command = resolve_pio_command().ok_or_else(|| {
        "PlatformIO CLI not found. Install PlatformIO Core and ensure `pio` is on PATH."
            .to_string()
    })?;

    let q = query.trim();
    if q.len() > 120 {
        return Err("Search query too long.".into());
    }

    let platform = platform
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());
    if let Some(ref p) = platform {
        if p.len() > 64
            || !p
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
        {
            return Err("Invalid platform filter.".into());
        }
    }

    let framework = framework
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());
    if let Some(ref f) = framework {
        if f.len() > 64
            || !f
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
        {
            return Err("Invalid framework filter.".into());
        }
    }

    // Empty query is allowed when browsing by platform/framework.
    if q.is_empty() && platform.is_none() && framework.is_none() {
        return Ok(vec![]);
    }

    let page_count = pages.unwrap_or(2).clamp(1, 4);
    let mut out: Vec<PioLibEntry> = Vec::new();
    let mut seen = std::collections::HashSet::new();
    let mut last_err = String::new();

    for page in 1..=page_count {
        let mut args: Vec<String> = vec![
            "lib".into(),
            "search".into(),
            "--json-output".into(),
            "--page".into(),
            page.to_string(),
        ];
        if let Some(ref p) = platform {
            args.push("--platform".into());
            args.push(p.clone());
        }
        if let Some(ref f) = framework {
            args.push("--framework".into());
            args.push(f.clone());
        }
        if !q.is_empty() {
            args.push(q.to_string());
        }

        // Registry search must fail fast when offline (DNS / TLS hang).
        let output = match run_pio_with_timeout(
            &command,
            &args,
            None,
            Duration::from_secs(12),
        ) {
            Ok(o) => o,
            Err(e) => {
                last_err = e;
                break;
            }
        };

        if !output.status.success() {
            last_err = command_failure_detail(&output, "Library search failed.");
            break;
        }

        let batch = parse_lib_search_json(&output.stdout);
        if batch.is_empty() {
            break;
        }
        let before = out.len();
        for entry in batch {
            let key = format!(
                "{}/{}",
                entry.owner.to_lowercase(),
                entry.name.to_lowercase()
            );
            if seen.insert(key) {
                out.push(entry);
            }
        }
        if out.len() == before {
            break;
        }
        if out.len() >= 40 {
            break;
        }
    }

    if !out.is_empty() {
        out.truncate(40);
        return Ok(out);
    }

    // Fallback: `pio pkg search` (human-readable; no --json-output on PIO 6.2).
    if q.is_empty() {
        return Err(if last_err.is_empty() {
            "Library search failed.".into()
        } else {
            last_err
        });
    }

    let pkg_args = vec![
        "pkg".into(),
        "search".into(),
        q.to_string(),
        "--sort".into(),
        "popularity".into(),
    ];
    let output =
        run_pio_with_timeout(&command, &pkg_args, None, Duration::from_secs(12))?;
    if !output.status.success() {
        return Err(if last_err.is_empty() {
            command_failure_detail(&output, "Library search failed.")
        } else {
            last_err
        });
    }

    Ok(parse_pkg_search_text(&output.stdout))
}

fn parse_lib_search_json(stdout: &[u8]) -> Vec<PioLibEntry> {
    let text = String::from_utf8_lossy(stdout);
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return vec![];
    }

    // Registry JSON shapes vary; accept array or { items: [] } / { result: [] }
    let value: serde_json::Value = match serde_json::from_str(trimmed) {
        Ok(v) => v,
        Err(_) => return vec![],
    };

    let items = if let Some(arr) = value.as_array() {
        arr.clone()
    } else if let Some(arr) = value.get("items").and_then(|v| v.as_array()) {
        arr.clone()
    } else if let Some(arr) = value.get("result").and_then(|v| v.as_array()) {
        arr.clone()
    } else {
        vec![value]
    };

    let mut out = Vec::new();
    for item in items.into_iter().take(40) {
        let name = item
            .get("name")
            .or_else(|| item.get("title"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if name.is_empty() {
            continue;
        }
        let owner = item
            .get("ownername")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .or_else(|| {
                item.get("owner").and_then(|v| {
                    v.as_str().map(|s| s.to_string()).or_else(|| {
                        v.get("username")
                            .and_then(|u| u.as_str())
                            .map(|s| s.to_string())
                    })
                })
            })
            .unwrap_or_default();
        let id = if !owner.is_empty() {
            format!("{owner}/{name}")
        } else {
            item.get("id")
                .map(|v| v.to_string().trim_matches('"').to_string())
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| name.clone())
        };
        let description = item
            .get("description")
            .or_else(|| item.get("short_description"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let version = item
            .get("versionname")
            .and_then(|v| v.as_str())
            .or_else(|| item.get("version").and_then(|v| v.as_str()))
            .or_else(|| {
                item.get("versions")
                    .and_then(|v| v.as_array())
                    .and_then(|a| a.first())
                    .and_then(|v| v.get("name").or_else(|| v.get("version")))
                    .and_then(|v| v.as_str())
            })
            .unwrap_or("")
            .to_string();
        let platforms = item
            .get("platforms")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|p| {
                        p.get("name")
                            .and_then(|n| n.as_str())
                            .or_else(|| p.as_str())
                            .map(|s| s.to_string())
                    })
                    .take(12)
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        out.push(PioLibEntry {
            id,
            name,
            owner,
            description,
            version,
            platforms,
        });
    }
    out
}

/// Parse human-readable `pio pkg search` blocks:
/// `owner/Name` then a line like `Library · 1.2.3 · …`
fn parse_pkg_search_text(stdout: &[u8]) -> Vec<PioLibEntry> {
    let text = String::from_utf8_lossy(stdout);
    let mut out = Vec::new();
    let mut lines = text.lines().peekable();
    while let Some(line) = lines.next() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("Found ") {
            continue;
        }
        // owner/name or bare name
        // Registry specs may include spaces: owner/Adafruit NeoPixel
        let (owner, name) = if let Some((o, n)) = trimmed.split_once('/') {
            let o = o.trim();
            let n = n.trim();
            if o.is_empty()
                || n.is_empty()
                || o.contains(' ')
                || o.len() > 64
                || n.len() > 80
                || !o
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == '.')
            {
                continue;
            }
            (o.to_string(), n.to_string())
        } else if trimmed
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == '.' || c == ' ')
            && trimmed.len() <= 80
        {
            (String::new(), trimmed.to_string())
        } else {
            continue;
        };

        let mut version = String::new();
        let mut description = String::new();
        if let Some(next) = lines.peek().map(|s| s.trim().to_string()) {
            let lower = next.to_lowercase();
            if lower.starts_with("library") || lower.contains('·') || lower.contains("published") {
                let _ = lines.next();
                // "Library · 7.4.3 · Published …"
                let parts: Vec<&str> = next.split('·').map(str::trim).collect();
                if parts.len() >= 2 {
                    let ver = parts[1].trim();
                    if !ver.is_empty()
                        && ver.len() < 32
                        && ver
                            .chars()
                            .all(|c| c.is_ascii_alphanumeric() || "._-+".contains(c))
                    {
                        version = ver.to_string();
                    }
                }
            }
        }
        if let Some(next) = lines.peek().map(|s| s.trim().to_string()) {
            if !next.is_empty()
                && !next.contains('/')
                && !next.to_lowercase().starts_with("library")
                && !next.starts_with("Found ")
            {
                let _ = lines.next();
                description = next;
            }
        }

        let id = if owner.is_empty() {
            name.clone()
        } else {
            format!("{owner}/{name}")
        };
        out.push(PioLibEntry {
            id,
            name,
            owner,
            description,
            version,
            platforms: vec![],
        });
        if out.len() >= 40 {
            break;
        }
    }
    out
}

/// Install a library into the project (`pio pkg install -l …` → lib_deps).
/// Emits progress lines to the PlatformIO output panel.
#[tauri::command]
pub fn pio_lib_install(
    app: AppHandle,
    cwd: String,
    library: String,
    env: Option<String>,
) -> Result<String, String> {
    let command = resolve_pio_command().ok_or_else(|| {
        "PlatformIO CLI not found. Install PlatformIO Core and ensure `pio` is on PATH."
            .to_string()
    })?;

    let lib = validate_lib_spec(&library)?;
    let env_name = validate_env_name(&env)?;

    let root = PathBuf::from(&cwd);
    if !root.join("platformio.ini").is_file() {
        return Err(
            "No platformio.ini in the workspace root. Open a PlatformIO project folder."
                .into(),
        );
    }

    emit_line(
        &app,
        "system",
        format!("Installing library {lib} (pio pkg install)…"),
    );

    // Try: pkg install -l (with env) → pkg install -l (no env) → legacy lib install.
    let mut attempts: Vec<Vec<String>> = Vec::new();
    let mut with_env = vec![
        "pkg".into(),
        "install".into(),
        "--library".into(),
        lib.to_string(),
    ];
    if let Some(e) = env_name {
        with_env.push("--environment".into());
        with_env.push(e.to_string());
        attempts.push(with_env);
        attempts.push(vec![
            "pkg".into(),
            "install".into(),
            "--library".into(),
            lib.to_string(),
        ]);
    } else {
        attempts.push(with_env);
    }
    if let Some(e) = env_name {
        attempts.push(vec![
            "lib".into(),
            "-e".into(),
            e.to_string(),
            "install".into(),
            lib.to_string(),
        ]);
    }
    attempts.push(vec!["lib".into(), "install".into(), lib.to_string()]);

    let mut last_err = String::new();
    let install_timeout = Duration::from_secs(120);
    for args in attempts {
        emit_line(&app, "system", format!("> {command} {}", args.join(" ")));
        let output = run_pio_with_timeout(&command, &args, Some(&root), install_timeout)?;
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let detail = if !stdout.is_empty() {
                stdout
            } else {
                stderr
            };
            for line in detail.lines().take(12) {
                emit_line(&app, "stdout", line.to_string());
            }
            emit_line(
                &app,
                "system",
                format!("✔ Library installed: {lib}"),
            );
            return Ok(detail);
        }
        last_err = command_failure_detail(&output, "Library install failed.");
        emit_line(&app, "stderr", last_err.clone());
    }

    emit_line(
        &app,
        "system",
        format!("✖ Library install failed: {lib}"),
    );
    Err(last_err)
}

/// Uninstall a library from the project (`pio pkg uninstall -l …`).
#[tauri::command]
pub fn pio_lib_uninstall(
    cwd: String,
    library: String,
    env: Option<String>,
) -> Result<String, String> {
    let command = resolve_pio_command().ok_or_else(|| {
        "PlatformIO CLI not found. Install PlatformIO Core and ensure `pio` is on PATH."
            .to_string()
    })?;

    let lib = validate_lib_spec(&library)?;
    let env_name = validate_env_name(&env)?;

    let root = PathBuf::from(&cwd);
    if !root.join("platformio.ini").is_file() {
        return Err(
            "No platformio.ini in the workspace root. Open a PlatformIO project folder."
                .into(),
        );
    }

    let mut attempts: Vec<Vec<String>> = Vec::new();
    let mut with_env = vec![
        "pkg".into(),
        "uninstall".into(),
        "--library".into(),
        lib.to_string(),
    ];
    if let Some(e) = env_name {
        with_env.push("--environment".into());
        with_env.push(e.to_string());
        attempts.push(with_env);
        attempts.push(vec![
            "pkg".into(),
            "uninstall".into(),
            "--library".into(),
            lib.to_string(),
        ]);
    } else {
        attempts.push(with_env);
    }
    attempts.push(vec!["lib".into(), "uninstall".into(), lib.to_string()]);

    let mut last_err = String::new();
    let uninstall_timeout = Duration::from_secs(90);
    for args in attempts {
        let output =
            run_pio_with_timeout(&command, &args, Some(&root), uninstall_timeout)?;
        if output.status.success() {
            return Ok(String::from_utf8_lossy(&output.stdout).trim().to_string());
        }
        last_err = command_failure_detail(&output, "Library uninstall failed.");
    }

    Err(last_err)
}

/// Read lib_deps lines from platformio.ini (best-effort).
#[tauri::command]
pub fn pio_lib_list(cwd: String) -> Result<Vec<String>, String> {
    let ini = PathBuf::from(&cwd).join("platformio.ini");
    if !ini.is_file() {
        return Ok(vec![]);
    }
    let text = std::fs::read_to_string(&ini).map_err(|e| e.to_string())?;
    let mut deps = Vec::new();
    let mut in_lib_deps = false;
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            in_lib_deps = false;
        }
        if trimmed.starts_with("lib_deps") && trimmed.contains('=') {
            in_lib_deps = true;
            if let Some(rest) = trimmed.split_once('=').map(|(_, r)| r.trim()) {
                if !rest.is_empty() {
                    for part in rest.split(',') {
                        let p = part.trim();
                        if !p.is_empty() {
                            deps.push(p.to_string());
                        }
                    }
                }
            }
            continue;
        }
        if in_lib_deps {
            if trimmed.is_empty() {
                continue;
            }
            if trimmed.starts_with('#') {
                continue;
            }
            if line.starts_with(' ') || line.starts_with('\t') {
                let p = trimmed.trim_start_matches(&['-', '*'][..]).trim();
                if !p.is_empty() {
                    deps.push(p.to_string());
                }
            } else if trimmed.contains('=') {
                in_lib_deps = false;
            } else if !trimmed.starts_with('[') {
                in_lib_deps = false;
            }
        }
    }
    deps.sort();
    deps.dedup();
    Ok(deps)
}

fn platformio_home() -> Option<PathBuf> {
    if let Ok(custom) = std::env::var("PLATFORMIO_CORE_DIR") {
        let p = PathBuf::from(custom);
        if !p.as_os_str().is_empty() {
            return Some(p);
        }
    }
    for key in ["USERPROFILE", "HOME"] {
        if let Ok(home) = std::env::var(key) {
            return Some(PathBuf::from(home).join(".platformio"));
        }
    }
    None
}

fn platform_installed(home: &Path, id: &str) -> bool {
    home.join("platforms").join(id).is_dir()
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfflineCacheStatus {
    pub home: Option<String>,
    pub espressif32: bool,
    pub atmelavr: bool,
}

/// Probe ~/.platformio for installed platforms used by bundled examples.
#[tauri::command]
pub fn pio_cache_status() -> Result<OfflineCacheStatus, String> {
    let Some(home) = platformio_home() else {
        return Ok(OfflineCacheStatus {
            home: None,
            espressif32: false,
            atmelavr: false,
        });
    };
    Ok(OfflineCacheStatus {
        home: Some(home.to_string_lossy().to_string()),
        espressif32: platform_installed(&home, "espressif32"),
        atmelavr: platform_installed(&home, "atmelavr"),
    })
}

/// Portable offline zip found next to the app / common drop folders (USB stick layout).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SidecarOfflineZip {
    pub path: String,
    /// `full` = OfflineCache (platforms+packages+lib), `libs` = OfflineLibs (lib only)
    pub kind: String,
}

fn is_aether_offline_zip_name(name: &str) -> Option<&'static str> {
    let lower = name.to_ascii_lowercase();
    if !lower.ends_with(".zip") {
        return None;
    }
    if lower.starts_with("aether_offlinecache_") || lower.starts_with("aether_offlinecache.") {
        return Some("full");
    }
    if lower.starts_with("aether_offlinelibs_") || lower.starts_with("aether_offlinelibs.") {
        return Some("libs");
    }
    None
}

fn push_offline_zips_from_dir(dir: &Path, out: &mut Vec<SidecarOfflineZip>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        let Some(kind) = is_aether_offline_zip_name(name) else {
            continue;
        };
        let path_str = path.to_string_lossy().to_string();
        if out.iter().any(|z| z.path.eq_ignore_ascii_case(&path_str)) {
            continue;
        }
        out.push(SidecarOfflineZip {
            path: path_str,
            kind: kind.into(),
        });
    }
}

/// Scan install dir, Desktop, Downloads, Documents\Aether for Aether_Offline*.zip (dist USB layout).
#[tauri::command]
pub fn pio_find_sidecar_offline_zips() -> Result<Vec<SidecarOfflineZip>, String> {
    let mut dirs: Vec<PathBuf> = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            dirs.push(dir.to_path_buf());
            if let Some(parent) = dir.parent() {
                dirs.push(parent.to_path_buf());
            }
        }
    }
    for key in ["USERPROFILE", "HOME"] {
        if let Ok(home) = std::env::var(key) {
            let home = PathBuf::from(home);
            dirs.push(home.join("Desktop"));
            dirs.push(home.join("Downloads"));
            dirs.push(home.join("Documents").join("Aether"));
            dirs.push(home.join("Documents").join("Aether").join("offline"));
            break;
        }
    }
    // Public Desktop (all-users shortcut / shared drop)
    if let Ok(public) = std::env::var("PUBLIC") {
        dirs.push(PathBuf::from(public).join("Desktop"));
    }

    let mut found = Vec::new();
    for dir in dirs {
        if dir.is_dir() {
            push_offline_zips_from_dir(&dir, &mut found);
        }
    }
    // Prefer full cache over libs-only when both exist
    found.sort_by(|a, b| {
        let rank = |k: &str| if k == "full" { 0 } else { 1 };
        rank(&a.kind)
            .cmp(&rank(&b.kind))
            .then_with(|| a.path.cmp(&b.path))
    });
    Ok(found)
}

/// Install espressif32 + atmelavr platforms (and their toolchains) into the global PIO cache.
/// Streams progress to the Output panel. Does not embed multi-GB toolchains in the installer.
#[tauri::command]
pub fn pio_prepare_offline_cache(
    app: AppHandle,
    state: State<'_, PioState>,
) -> Result<(), String> {
    let command = resolve_pio_command().ok_or_else(|| {
        "PlatformIO CLI not found. Install PlatformIO Core first (Tools Doctor → Install missing)."
            .to_string()
    })?;

    if state.running.load(Ordering::SeqCst) {
        return Err("A PlatformIO task is already running.".into());
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
            task: Some("offline-cache".into()),
            success: None,
            code: None,
            error: None,
        },
    );
    emit_line(
        &app,
        "system",
        "Preparing offline cache: espressif32 + atmelavr + LoRa/Arduino libs…".into(),
    );
    emit_line(
        &app,
        "system",
        "Downloads platforms, toolchains, and curated libraries (RadioLib, ArduinoJson, …) into ~/.platformio.".into(),
    );

    let app_bg = app.clone();
    let running = Arc::clone(&state.running);
    let child_slot = Arc::clone(&state.child);

    thread::spawn(move || {
        let platforms = ["espressif32", "atmelavr"];
        let mut all_ok = true;

        for platform in platforms {
            if !running.load(Ordering::SeqCst) {
                all_ok = false;
                break;
            }

            let attempts: [Vec<String>; 2] = [
                vec![
                    "pkg".into(),
                    "install".into(),
                    "-g".into(),
                    "-p".into(),
                    platform.into(),
                ],
                vec!["platform".into(), "install".into(), platform.into()],
            ];

            let mut platform_ok = false;
            for args in &attempts {
                emit_line(
                    &app_bg,
                    "system",
                    format!("> {command} {}", args.join(" ")),
                );

                let mut child_cmd = Command::new(&command);
                child_cmd
                    .args(args)
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .stdin(Stdio::null());
                configure_pio_command(&mut child_cmd);

                let mut child = match child_cmd.spawn() {
                    Ok(c) => c,
                    Err(e) => {
                        emit_line(&app_bg, "stderr", format!("Failed to start: {e}"));
                        continue;
                    }
                };

                let stdout = child.stdout.take();
                let stderr = child.stderr.take();
                {
                    let mut slot = child_slot.lock().unwrap_or_else(|e| e.into_inner());
                    *slot = Some(child);
                }

                let app_out = app_bg.clone();
                let out_handle = thread::spawn(move || {
                    if let Some(out) = stdout {
                        for line in BufReader::new(out).lines().map_while(Result::ok) {
                            emit_line(&app_out, "stdout", line);
                        }
                    }
                });
                let app_err = app_bg.clone();
                let err_handle = thread::spawn(move || {
                    if let Some(err) = stderr {
                        for line in BufReader::new(err).lines().map_while(Result::ok) {
                            emit_line(&app_err, "stderr", line);
                        }
                    }
                });

                let status = loop {
                    let outcome = {
                        let mut slot = child_slot.lock().unwrap_or_else(|e| e.into_inner());
                        match slot.as_mut() {
                            None => Some(None),
                            Some(c) => match c.try_wait() {
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
                    thread::sleep(std::time::Duration::from_millis(50));
                };

                let _ = out_handle.join();
                let _ = err_handle.join();

                if let Some(s) = status {
                    if s.success() {
                        platform_ok = true;
                        emit_line(
                            &app_bg,
                            "system",
                            format!("✔ Platform ready: {platform}"),
                        );
                        break;
                    }
                }
            }

            if !platform_ok {
                all_ok = false;
                emit_line(
                    &app_bg,
                    "system",
                    format!("✖ Failed to install platform: {platform}"),
                );
            }
        }

        // Curated global libraries (ESP32 / Mega / LoRa stacks).
        let libs = [
            "jgromes/RadioLib",
            "bblanchon/ArduinoJson",
            "adafruit/Adafruit GFX Library",
            "adafruit/Adafruit SSD1306",
            "adafruit/Adafruit BusIO",
            "olikraus/U8g2",
            "sandeepmistry/LoRa",
            "mcci-catena/MCCI LoRaWAN LMIC library",
            "knolleary/PubSubClient",
            "fastled/FastLED",
            "adafruit/Adafruit NeoPixel",
            "madhephaestus/ESP32Servo",
            "arduino-libraries/Servo",
        ];
        for lib in libs {
            if !running.load(Ordering::SeqCst) {
                all_ok = false;
                break;
            }
            let args: Vec<String> = vec![
                "pkg".into(),
                "install".into(),
                "-g".into(),
                "-l".into(),
                lib.into(),
            ];
            emit_line(
                &app_bg,
                "system",
                format!("> {command} {}", args.join(" ")),
            );
            let mut child_cmd = Command::new(&command);
            child_cmd
                .args(&args)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .stdin(Stdio::null());
            configure_pio_command(&mut child_cmd);
            let mut child = match child_cmd.spawn() {
                Ok(c) => c,
                Err(e) => {
                    emit_line(&app_bg, "stderr", format!("Failed to start: {e}"));
                    all_ok = false;
                    continue;
                }
            };
            let stdout = child.stdout.take();
            let stderr = child.stderr.take();
            {
                let mut slot = child_slot.lock().unwrap_or_else(|e| e.into_inner());
                *slot = Some(child);
            }
            let app_out = app_bg.clone();
            let out_handle = thread::spawn(move || {
                if let Some(out) = stdout {
                    for line in BufReader::new(out).lines().map_while(Result::ok) {
                        emit_line(&app_out, "stdout", line);
                    }
                }
            });
            let app_err = app_bg.clone();
            let err_handle = thread::spawn(move || {
                if let Some(err) = stderr {
                    for line in BufReader::new(err).lines().map_while(Result::ok) {
                        emit_line(&app_err, "stderr", line);
                    }
                }
            });
            let status = loop {
                let outcome = {
                    let mut slot = child_slot.lock().unwrap_or_else(|e| e.into_inner());
                    match slot.as_mut() {
                        None => Some(None),
                        Some(c) => match c.try_wait() {
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
                thread::sleep(std::time::Duration::from_millis(50));
            };
            let _ = out_handle.join();
            let _ = err_handle.join();
            if let Some(s) = status {
                if s.success() {
                    emit_line(&app_bg, "system", format!("✔ Library ready: {lib}"));
                } else {
                    emit_line(
                        &app_bg,
                        "system",
                        format!("✖ Failed library (non-fatal): {lib}"),
                    );
                }
            }
        }

        running.store(false, Ordering::SeqCst);
        emit_line(
            &app_bg,
            "system",
            if all_ok {
                "✔ Offline cache prepared (platforms + libs). You can copy ~/.platformio or export a zip via npm run build:offline-cache.".into()
            } else {
                "✖ Offline cache finished with errors — see output above.".into()
            },
        );
        emit_status(
            &app_bg,
            PioStatusPayload {
                running: false,
                task: Some("offline-cache".into()),
                success: Some(all_ok),
                code: if all_ok { Some(0) } else { Some(1) },
                error: None,
            },
        );
    });

    Ok(())
}

/// Import a portable offline-cache zip into ~/.platformio (merge platforms/packages).
#[tauri::command]
pub fn pio_import_offline_cache(
    app: AppHandle,
    state: State<'_, PioState>,
    zip_path: String,
) -> Result<(), String> {
    let zip_path = PathBuf::from(zip_path.trim());
    if !zip_path.is_file() {
        return Err("Offline cache zip not found.".into());
    }
    let ext = zip_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if ext != "zip" {
        return Err("Offline cache must be a .zip file.".into());
    }

    let home = platformio_home().ok_or_else(|| {
        "Could not resolve PlatformIO home (~/.platformio).".to_string()
    })?;

    if state.running.load(Ordering::SeqCst) {
        return Err("A PlatformIO task is already running.".into());
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
            task: Some("offline-cache-import".into()),
            success: None,
            code: None,
            error: None,
        },
    );
    emit_line(
        &app,
        "system",
        format!(
            "Importing offline cache from {} → {} …",
            zip_path.display(),
            home.display()
        ),
    );

    let app_bg = app.clone();
    let running = Arc::clone(&state.running);

    thread::spawn(move || {
        let result = import_offline_cache_zip(&app_bg, &zip_path, &home);
        let ok = result.is_ok();
        if let Err(e) = result {
            emit_line(&app_bg, "stderr", e);
        } else {
            emit_line(
                &app_bg,
                "system",
                "✔ Offline cache imported (merged into ~/.platformio).".into(),
            );
        }
        running.store(false, Ordering::SeqCst);
        emit_status(
            &app_bg,
            PioStatusPayload {
                running: false,
                task: Some("offline-cache-import".into()),
                success: Some(ok),
                code: if ok { Some(0) } else { Some(1) },
                error: None,
            },
        );
    });

    Ok(())
}

fn import_offline_cache_zip(
    app: &AppHandle,
    zip_path: &Path,
    home: &Path,
) -> Result<(), String> {
    let file = File::open(zip_path).map_err(|e| format!("Failed to open zip: {e}"))?;
    let mut archive =
        ZipArchive::new(file).map_err(|e| format!("Invalid offline cache zip: {e}"))?;

    let names: Vec<String> = (0..archive.len())
        .filter_map(|i| archive.by_index(i).ok().map(|f| f.name().replace('\\', "/")))
        .collect();

    if names.is_empty() {
        return Err("Offline cache zip is empty.".into());
    }
    for name in &names {
        if name.split('/').any(|p| p == "..") {
            return Err("Invalid offline cache zip (path traversal).".into());
        }
    }

    let strip = detect_offline_cache_strip_prefix(&names).ok_or_else(|| {
        "Invalid offline cache zip: expected platforms/… and/or lib/ (see docs/OFFLINE_INSTALLER.md)."
            .to_string()
    })?;

    let mut has_espressif = false;
    let mut has_atmel = false;
    let mut has_lib = false;
    let mut extract_count = 0usize;
    let total_candidates = names
        .iter()
        .filter(|n| {
            let rel = strip_zip_prefix(n, &strip);
            is_offline_cache_member(rel)
        })
        .count()
        .max(1);

    emit_line(
        app,
        "system",
        format!(
            "Validated zip structure (strip_prefix={:?}). Extracting ~{total_candidates} entries…",
            if strip.is_empty() { "<root>" } else { strip.as_str() }
        ),
    );

    fs::create_dir_all(home).map_err(|e| format!("Failed to create {}: {e}", home.display()))?;

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("Zip read error: {e}"))?;
        let raw_name = entry.name().replace('\\', "/");
        if raw_name.split('/').any(|p| p == "..") {
            continue;
        }
        let rel = strip_zip_prefix(&raw_name, &strip);
        if !is_offline_cache_member(rel) {
            continue;
        }
        if rel.starts_with("platforms/espressif32") {
            has_espressif = true;
        }
        if rel.starts_with("platforms/atmelavr") {
            has_atmel = true;
        }
        if rel.starts_with("lib/") {
            has_lib = true;
        }

        let out_path = safe_join_under(home, rel)
            .ok_or_else(|| format!("Refusing unsafe zip path: {rel}"))?;

        if raw_name.ends_with('/') || entry.is_dir() {
            fs::create_dir_all(&out_path)
                .map_err(|e| format!("Failed to create {}: {e}", out_path.display()))?;
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create {}: {e}", parent.display()))?;
            }
            let mut outfile = File::create(&out_path)
                .map_err(|e| format!("Failed to write {}: {e}", out_path.display()))?;
            std::io::copy(&mut entry, &mut outfile)
                .map_err(|e| format!("Failed to extract {}: {e}", out_path.display()))?;
        }

        extract_count += 1;
        if extract_count == 1
            || extract_count % 50 == 0
            || extract_count == total_candidates
        {
            let pct = (extract_count * 100) / total_candidates;
            emit_line(
                app,
                "system",
                format!("Extracting… {pct}% ({extract_count}/{total_candidates})"),
            );
        }
    }

    if !has_espressif && !has_atmel && !has_lib {
        return Err(
            "Invalid offline cache zip: no platforms or lib/ content found after extract.".into(),
        );
    }

    emit_line(
        app,
        "system",
        format!(
            "Merged {extract_count} entries. espressif32={} atmelavr={} lib={}",
            if has_espressif { "yes" } else { "no" },
            if has_atmel { "yes" } else { "no" },
            if has_lib { "yes" } else { "no" }
        ),
    );
    Ok(())
}

fn detect_offline_cache_strip_prefix(names: &[String]) -> Option<String> {
    let markers = [
        "platforms/espressif32",
        "platforms/atmelavr",
        "lib/",
        "packages/",
    ];
    for name in names {
        let n = name.trim_start_matches("./");
        for marker in markers {
            if let Some(idx) = n.find(marker) {
                return Some(n[..idx].to_string());
            }
        }
    }
    for name in names {
        let n = name.trim_start_matches("./");
        if n == "aether-offline-cache.json" || n.ends_with("/aether-offline-cache.json") {
            let idx = n.rfind("aether-offline-cache.json").unwrap_or(0);
            return Some(n[..idx].to_string());
        }
    }
    None
}

fn strip_zip_prefix<'a>(name: &'a str, strip: &str) -> &'a str {
    let n = name.trim_start_matches("./");
    if strip.is_empty() {
        return n;
    }
    n.strip_prefix(strip).unwrap_or(n)
}

fn is_offline_cache_member(rel: &str) -> bool {
    let rel = rel.trim_start_matches('/');
    if rel.is_empty() || rel == "aether-offline-cache.json" {
        return rel == "aether-offline-cache.json";
    }
    rel.starts_with("platforms/")
        || rel.starts_with("packages/")
        || rel.starts_with("lib/")
}

fn safe_join_under(base: &Path, relative: &str) -> Option<PathBuf> {
    let relative = relative.trim_start_matches('/');
    let mut out = base.to_path_buf();
    for comp in Path::new(relative).components() {
        match comp {
            Component::Normal(part) => out.push(part),
            Component::CurDir => {}
            _ => return None,
        }
    }
    if !out.starts_with(base) {
        return None;
    }
    Some(out)
}
