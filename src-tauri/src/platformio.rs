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
) -> Result<std::process::Output, String> {
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
        | "esp32-c3-devkitm-1" => "espressif32",
        "esp8266" | "nodemcuv2" | "d1_mini" => "espressif8266",
        "uno" | "nanoatmega328" | "megaatmega2560" | "leonardo" | "micro" => "atmelavr",
        "teensy41" | "teensy40" | "teensy36" => "teensy",
        "pico" | "pico2" => "raspberrypi",
        _ if board.starts_with("esp32") => "espressif32",
        _ if board.starts_with("esp8266") => "espressif8266",
        _ => "atmelavr",
    }
}

fn is_esp32_family(board: &str) -> bool {
    board.starts_with("esp32") || matches!(board, "esp32dev" | "esp32doit-devkit-v1")
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
    if s.is_empty() || s == "none" || s == "blink" || s == "servo" {
        return Ok(if s.is_empty() { "none" } else { s });
    }
    Err("Invalid starter template.".into())
}

fn write_wizard_project_files(
    project_dir: &Path,
    board: &str,
    framework: &str,
    starter: &str,
) -> Result<(), String> {
    let platform = platform_for_board(board);
    let env_name = board;
    let mut lib_deps = String::new();
    if starter == "servo" {
        if is_esp32_family(board) {
            lib_deps.push_str("lib_deps =\n\tmadhephaestus/ESP32Servo@^3.0.6\n");
        } else {
            lib_deps.push_str("lib_deps =\n\tarduino-libraries/Servo@^1.2.2\n");
        }
    }

    let ini = format!(
        "; PlatformIO Project Configuration File\n\
         ; Created by Aether project wizard\n\n\
         [env:{env_name}]\n\
         platform = {platform}\n\
         board = {board}\n\
         framework = {framework}\n\
         monitor_speed = 115200\n\
         {lib_deps}"
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

    if let Err(err) = write_wizard_project_files(&project_dir, board, framework, starter) {
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
    if lib.is_empty() || lib.len() > 200 {
        return Err("Invalid library id.".into());
    }
    if lib.contains("..") || lib.contains('\\') || lib.contains('\0') {
        return Err("Invalid library id.".into());
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

        let output = match run_pio(&command, &args, None) {
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
    let output = run_pio(&command, &pkg_args, None)?;

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
#[tauri::command]
pub fn pio_lib_install(
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
    for args in attempts {
        let output = run_pio(&command, &args, Some(&root))?;
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Ok(if !stdout.is_empty() { stdout } else { stderr });
        }
        last_err = command_failure_detail(&output, "Library install failed.");
    }

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
    for args in attempts {
        let output = run_pio(&command, &args, Some(&root))?;
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
