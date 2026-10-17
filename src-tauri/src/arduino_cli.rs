//! Arduino CLI detection, library search/install, and sketch compile/upload.

use std::fs;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::sync::atomic::Ordering;
use std::thread;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, State};

use crate::platformio::{
    emit_line, emit_status, PioLibEntry, PioState, PioStatusPayload,
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArduinoCliInfo {
    pub installed: bool,
    pub path: Option<String>,
    pub version: Option<String>,
}

fn path_ok(path: &Path) -> bool {
    path.is_file()
}

fn common_install_candidates() -> Vec<PathBuf> {
    let mut out = Vec::new();

    #[cfg(windows)]
    {
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            let local = PathBuf::from(local);
            out.push(local.join("Arduino CLI").join("arduino-cli.exe"));
            out.push(
                local
                    .join("Programs")
                    .join("Arduino CLI")
                    .join("arduino-cli.exe"),
            );
            out.push(
                local
                    .join("Arduino15")
                    .join("arduino-cli.exe"),
            );
        }
        if let Ok(pf) = std::env::var("ProgramFiles") {
            let pf = PathBuf::from(pf);
            out.push(pf.join("Arduino CLI").join("arduino-cli.exe"));
            out.push(pf.join("Arduino").join("arduino-cli.exe"));
        }
        if let Ok(pf86) = std::env::var("ProgramFiles(x86)") {
            let pf86 = PathBuf::from(pf86);
            out.push(pf86.join("Arduino CLI").join("arduino-cli.exe"));
            out.push(pf86.join("Arduino").join("arduino-cli.exe"));
        }
        if let Ok(home) = std::env::var("USERPROFILE") {
            let home = PathBuf::from(home);
            out.push(
                home.join("scoop")
                    .join("apps")
                    .join("arduino-cli")
                    .join("current")
                    .join("arduino-cli.exe"),
            );
            out.push(
                home.join("scoop")
                    .join("shims")
                    .join("arduino-cli.exe"),
            );
            out.push(
                home.join("AppData")
                    .join("Local")
                    .join("Microsoft")
                    .join("WinGet")
                    .join("Links")
                    .join("arduino-cli.exe"),
            );
        }
        if let Ok(chocolatey) = std::env::var("ChocolateyInstall") {
            out.push(
                PathBuf::from(chocolatey)
                    .join("bin")
                    .join("arduino-cli.exe"),
            );
        }
    }

    #[cfg(not(windows))]
    {
        out.push(PathBuf::from("/usr/local/bin/arduino-cli"));
        out.push(PathBuf::from("/usr/bin/arduino-cli"));
        if let Ok(home) = std::env::var("HOME") {
            let home = PathBuf::from(home);
            out.push(home.join(".local").join("bin").join("arduino-cli"));
            out.push(
                home.join("bin").join("arduino-cli"),
            );
            out.push(
                home.join("Arduino")
                    .join("arduino-cli"),
            );
        }
    }

    out
}

fn resolve_arduino_cli() -> Option<PathBuf> {
    #[cfg(windows)]
    let path_names = ["arduino-cli.exe", "arduino-cli"];
    #[cfg(not(windows))]
    let path_names = ["arduino-cli"];

    for name in path_names {
        if let Ok(path) = which::which(name) {
            if path_ok(&path) {
                return Some(path);
            }
        }
    }

    for candidate in common_install_candidates() {
        if path_ok(&candidate) {
            return Some(candidate);
        }
    }

    None
}

fn configure_cli_command(cmd: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
}

fn run_cli(cli: &Path, args: &[&str], cwd: Option<&Path>) -> Result<Output, String> {
    let mut cmd = Command::new(cli);
    cmd.args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }
    configure_cli_command(&mut cmd);
    cmd.output()
        .map_err(|e| format!("Failed to run arduino-cli: {e}"))
}

fn run_cli_with_timeout(
    cli: &Path,
    args: &[&str],
    cwd: Option<&Path>,
    timeout: Duration,
) -> Result<Output, String> {
    let mut cmd = Command::new(cli);
    cmd.args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }
    configure_cli_command(&mut cmd);
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to run arduino-cli: {e}"))?;

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
                        "arduino-cli timed out after {}s (offline or slow registry?).",
                        timeout.as_secs()
                    ));
                }
                thread::sleep(Duration::from_millis(40));
            }
            Err(e) => {
                let _ = child.kill();
                return Err(format!("Failed to wait for arduino-cli: {e}"));
            }
        }
    }
}

fn failure_detail(output: &std::process::Output, fallback: &str) -> String {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if !stderr.is_empty() {
        stderr
    } else if !stdout.is_empty() {
        stdout
    } else {
        fallback.to_string()
    }
}

fn validate_lib_name(name: &str) -> Result<&str, String> {
    let n = name.trim();
    if n.is_empty() || n.len() > 120 {
        return Err("Invalid library name.".into());
    }
    if n.contains("..") || n.contains('/') || n.contains('\\') || n.contains('\0') {
        return Err("Invalid library name.".into());
    }
    if n.chars().any(|c| {
        matches!(
            c,
            ';' | '|' | '&' | '`' | '$' | '\n' | '\r' | '<' | '>' | '"' | '\''
        )
    }) {
        return Err("Invalid library name.".into());
    }
    Ok(n)
}

/// Map common PlatformIO `board = …` ids to Arduino FQBN.
pub(crate) fn pio_board_to_fqbn(board: &str) -> Option<&'static str> {
    let b = board.trim().to_ascii_lowercase();
    Some(match b.as_str() {
        "uno" => "arduino:avr:uno",
        "uno_r4_minima" | "unor4minima" => "arduino:renesas_uno:minima",
        "uno_r4_wifi" | "unor4wifi" => "arduino:renesas_uno:unor4wifi",
        "nanoatmega328" | "nano" => "arduino:avr:nano",
        "nanoatmega328new" => "arduino:avr:nano:cpu=atmega328new",
        "megaatmega2560" | "mega" => "arduino:avr:mega",
        "leonardo" => "arduino:avr:leonardo",
        "micro" => "arduino:avr:micro",
        "pro16mhzatmega328" | "pro" => "arduino:avr:pro",
        "diecimilaatmega328" => "arduino:avr:diecimila",
        "esplora" => "arduino:avr:esplora",
        "ethernet" => "arduino:avr:ethernet",
        "robotControl" | "robotcontrol" => "arduino:avr:robotControl",
        "robotMotor" | "robotmotor" => "arduino:avr:robotMotor",
        "esp32dev" | "esp32doit-devkit-v1" => "esp32:esp32:esp32",
        "esp32-s3-devkitc-1" | "esp32-s3-devkitc1" => "esp32:esp32:esp32s3",
        "esp32-c3-devkitm-1" => "esp32:esp32:esp32c3",
        "heltec_wifi_lora_32" => "esp32:esp32:heltec_wifi_lora_32",
        "heltec_wifi_lora_32_V2" | "heltec_wifi_lora_32_v2" => {
            "esp32:esp32:heltec_wifi_lora_32_V2"
        }
        "heltec_wifi_lora_32_V3" | "heltec_wifi_lora_32_v3" => {
            "esp32:esp32:heltec_wifi_lora_32_V3"
        }
        "ttgo-lora32-v1" | "ttgo-lora32-v2" | "ttgo-t-beam" => "esp32:esp32:ttgo-lora32",
        "nodemcuv2" => "esp8266:esp8266:nodemcuv2",
        "d1_mini" => "esp8266:esp8266:d1_mini",
        "esp01_1m" => "esp8266:esp8266:generic",
        _ => return None,
    })
}

fn board_from_ini(ini: &str, env: Option<&str>) -> Option<String> {
    let env_name = env
        .map(str::trim)
        .filter(|e| !e.is_empty())
        .map(|e| e.strip_prefix("env:").unwrap_or(e).to_string());

    let mut current_env: Option<String> = None;
    let mut global_board: Option<String> = None;
    let mut env_board: Option<String> = None;

    for raw in ini.lines() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with(';') || line.starts_with('#') {
            continue;
        }
        if line.starts_with('[') && line.ends_with(']') {
            let section = &line[1..line.len() - 1];
            if let Some(rest) = section.strip_prefix("env:") {
                current_env = Some(rest.to_string());
            } else {
                current_env = None;
            }
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        if key.trim() != "board" {
            continue;
        }
        let board = value.trim().to_string();
        if board.is_empty() {
            continue;
        }
        match (&current_env, &env_name) {
            (Some(cur), Some(want)) if cur == want => env_board = Some(board),
            (None, _) => {
                if global_board.is_none() {
                    global_board = Some(board);
                }
            }
            (Some(_), None) => {
                if env_board.is_none() {
                    env_board = Some(board);
                }
            }
            _ => {}
        }
    }

    env_board.or(global_board)
}

fn find_sketch_dir(root: &Path) -> Result<PathBuf, String> {
    let mut ino_files: Vec<PathBuf> = Vec::new();

    if let Ok(entries) = fs::read_dir(root) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if path
                    .extension()
                    .and_then(|e| e.to_str())
                    .is_some_and(|e| e.eq_ignore_ascii_case("ino"))
                {
                    ino_files.push(path);
                }
            }
        }
    }

    let src = root.join("src");
    if src.is_dir() {
        if let Ok(entries) = fs::read_dir(&src) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file()
                    && path
                        .extension()
                        .and_then(|e| e.to_str())
                        .is_some_and(|e| e.eq_ignore_ascii_case("ino"))
                {
                    ino_files.push(path);
                }
            }
        }
    }

    if ino_files.is_empty() {
        return Err(
            "No .ino sketch found. Arduino CLI needs a .ino file (root or src/). Use PlatformIO for .cpp-only projects."
                .into(),
        );
    }

    // Prefer root sketch, then src/.
    ino_files.sort_by(|a, b| {
        let a_src = a.starts_with(&src);
        let b_src = b.starts_with(&src);
        a_src.cmp(&b_src).then_with(|| a.cmp(b))
    });

    let ino = &ino_files[0];
    Ok(ino
        .parent()
        .unwrap_or(root)
        .to_path_buf())
}

fn resolve_fqbn(root: &Path, env: Option<&str>, fqbn: Option<&str>) -> Result<String, String> {
    if let Some(explicit) = fqbn.map(str::trim).filter(|s| !s.is_empty()) {
        if explicit.contains('\0') || explicit.len() > 200 {
            return Err("Invalid FQBN.".into());
        }
        return Ok(explicit.to_string());
    }

    let ini_path = root.join("platformio.ini");
    if !ini_path.is_file() {
        return Err(
            "No FQBN and no platformio.ini — open a project with board= or pass FQBN.".into(),
        );
    }
    let ini = fs::read_to_string(&ini_path).map_err(|e| format!("Cannot read platformio.ini: {e}"))?;
    let board = board_from_ini(&ini, env).ok_or_else(|| {
        "Could not read board= from platformio.ini for Arduino CLI FQBN.".to_string()
    })?;
    pio_board_to_fqbn(&board).map(|s| s.to_string()).ok_or_else(|| {
        format!(
            "No Arduino FQBN mapping for board '{board}'. Switch build tool to PlatformIO, or use a common Arduino/ESP board (uno, megaatmega2560, esp32dev, …)."
        )
    })
}

/// Platform id for `core install` / `core list` (`arduino:avr`, `esp32:esp32`, …).
fn fqbn_platform(fqbn: &str) -> Option<String> {
    let parts: Vec<&str> = fqbn.split(':').collect();
    if parts.len() < 2 {
        return None;
    }
    let vendor = parts[0].trim();
    let arch = parts[1].trim();
    if vendor.is_empty() || arch.is_empty() {
        return None;
    }
    Some(format!("{vendor}:{arch}"))
}

const ESP32_BOARD_INDEX_URL: &str =
    "https://espressif.github.io/arduino-esp32/package_esp32_index.json";
const ESP8266_BOARD_INDEX_URL: &str =
    "https://arduino.esp8266.com/stable/package_esp8266com_index.json";

fn ensure_board_index_url(cli: &Path, url: &str) {
    let _ = run_cli(
        cli,
        &["config", "add", "board_manager.additional_urls", url],
        None,
    );
}

fn core_list_installed(cli: &Path) -> Result<Vec<String>, String> {
    let output = run_cli_with_timeout(
        cli,
        &["core", "list", "--format", "json"],
        None,
        Duration::from_secs(20),
    )?;
    if !output.status.success() {
        return Err(failure_detail(&output, "arduino-cli core list failed."));
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let value: serde_json::Value = serde_json::from_str(text.trim()).unwrap_or(serde_json::Value::Null);
    let mut platforms = Vec::new();
    let items = value
        .get("platforms")
        .and_then(|v| v.as_array())
        .cloned()
        .or_else(|| value.as_array().cloned())
        .unwrap_or_default();
    for item in items {
        let id = item
            .get("id")
            .or_else(|| item.get("ID"))
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .or_else(|| {
                let vendor = item.get("maintainer").or_else(|| item.get("vendor"))?.as_str()?;
                let arch = item.get("architecture").or_else(|| item.get("arch"))?.as_str()?;
                Some(format!("{vendor}:{arch}"))
            });
        if let Some(id) = id {
            if !id.is_empty() {
                platforms.push(id);
            }
        }
    }
    Ok(platforms)
}

fn core_is_installed(installed: &[String], platform: &str) -> bool {
    let want = platform.to_ascii_lowercase();
    installed
        .iter()
        .any(|p| p.eq_ignore_ascii_case(platform) || p.to_ascii_lowercase().starts_with(&want))
}

/// Ensure the Arduino core for `fqbn` is installed (at least avr + esp32 when needed).
fn ensure_core_for_fqbn(cli: &Path, fqbn: &str, app: &AppHandle) -> Result<(), String> {
    let Some(platform) = fqbn_platform(fqbn) else {
        return Err(format!("Invalid FQBN (expected vendor:arch:board): {fqbn}"));
    };

    let installed = core_list_installed(cli).unwrap_or_default();
    if core_is_installed(&installed, &platform) {
        emit_line(
            app,
            "system",
            format!("arduino-cli core already installed: {platform}"),
        );
        return Ok(());
    }

    emit_line(
        app,
        "system",
        format!("arduino-cli core missing — installing {platform}…"),
    );

    let lower = platform.to_ascii_lowercase();
    if lower.starts_with("esp32:") {
        ensure_board_index_url(cli, ESP32_BOARD_INDEX_URL);
    } else if lower.starts_with("esp8266:") {
        ensure_board_index_url(cli, ESP8266_BOARD_INDEX_URL);
    }

    let update = run_cli_with_timeout(
        cli,
        &["core", "update-index"],
        None,
        Duration::from_secs(120),
    )?;
    if !update.status.success() {
        emit_line(
            app,
            "stderr",
            failure_detail(&update, "arduino-cli core update-index failed (continuing)."),
        );
    }

    let install = run_cli_with_timeout(
        cli,
        &["core", "install", &platform],
        None,
        Duration::from_secs(600),
    )?;
    if !install.status.success() {
        return Err(format!(
            "Failed to install Arduino core '{platform}': {}",
            failure_detail(&install, "arduino-cli core install failed.")
        ));
    }

    emit_line(
        app,
        "system",
        format!("✔ Arduino core installed: {platform}"),
    );
    Ok(())
}

/// Verify / install common cores (avr + esp32). Safe to call from Doctor.
#[tauri::command]
pub fn arduino_cli_ensure_cores() -> Result<String, String> {
    let cli = resolve_arduino_cli().ok_or_else(|| {
        "arduino-cli not found. Install from https://arduino.github.io/arduino-cli/latest/installation/"
            .to_string()
    })?;

    let mut messages = Vec::new();
    for platform in ["arduino:avr", "esp32:esp32"] {
        let installed = core_list_installed(&cli).unwrap_or_default();
        if core_is_installed(&installed, platform) {
            messages.push(format!("{platform}: ok"));
            continue;
        }
        if platform.starts_with("esp32:") {
            ensure_board_index_url(&cli, ESP32_BOARD_INDEX_URL);
        }
        let _ = run_cli_with_timeout(
            &cli,
            &["core", "update-index"],
            None,
            Duration::from_secs(120),
        );
        let install = run_cli_with_timeout(
            &cli,
            &["core", "install", platform],
            None,
            Duration::from_secs(600),
        )?;
        if !install.status.success() {
            return Err(format!(
                "Failed to install Arduino core '{platform}': {}",
                failure_detail(&install, "arduino-cli core install failed.")
            ));
        }
        messages.push(format!("{platform}: installed"));
    }
    Ok(messages.join("; "))
}

/// Detect `arduino-cli` on PATH or common install locations.
#[tauri::command]
pub fn arduino_cli_detect() -> Result<ArduinoCliInfo, String> {
    let Some(path) = resolve_arduino_cli() else {
        return Ok(ArduinoCliInfo {
            installed: false,
            path: None,
            version: None,
        });
    };
    let output = run_cli(&path, &["version", "--format", "text"], None)?;
    let version = if output.status.success() {
        let text = String::from_utf8_lossy(&output.stdout);
        let line = text.lines().next().unwrap_or("").trim();
        if line.is_empty() {
            None
        } else {
            Some(line.to_string())
        }
    } else {
        None
    };
    Ok(ArduinoCliInfo {
        installed: true,
        path: Some(path.display().to_string()),
        version,
    })
}

/// Search Arduino Library Manager via `arduino-cli lib search --format json`.
#[tauri::command]
pub fn arduino_cli_lib_search(query: String) -> Result<Vec<PioLibEntry>, String> {
    let cli = resolve_arduino_cli().ok_or_else(|| {
        "arduino-cli not found on PATH. Install from https://arduino.github.io/arduino-cli/"
            .to_string()
    })?;
    let q = query.trim();
    if q.is_empty() {
        return Ok(vec![]);
    }
    if q.len() > 120 {
        return Err("Search query too long.".into());
    }

    let output = run_cli_with_timeout(
        &cli,
        &["lib", "search", q, "--format", "json"],
        None,
        Duration::from_secs(12),
    )?;
    if !output.status.success() {
        return Err(failure_detail(&output, "arduino-cli lib search failed."));
    }

    Ok(parse_lib_search_json(&output.stdout))
}

fn parse_lib_search_json(stdout: &[u8]) -> Vec<PioLibEntry> {
    let text = String::from_utf8_lossy(stdout);
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return vec![];
    }
    let value: serde_json::Value = match serde_json::from_str(trimmed) {
        Ok(v) => v,
        Err(_) => return vec![],
    };

    let items = value
        .get("libraries")
        .and_then(|v| v.as_array())
        .cloned()
        .or_else(|| value.as_array().cloned())
        .unwrap_or_default();

    let mut out = Vec::new();
    for item in items.into_iter().take(40) {
        let name = item
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if name.is_empty() {
            continue;
        }
        let latest = item.get("latest").cloned().unwrap_or(serde_json::Value::Null);
        let version = latest
            .get("version")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let description = latest
            .get("sentence")
            .or_else(|| latest.get("paragraph"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let owner = latest
            .get("author")
            .and_then(|v| v.as_str())
            .unwrap_or("arduino")
            .to_string();
        let id = format!("arduino:{name}");
        out.push(PioLibEntry {
            id,
            name,
            owner,
            description,
            version,
            platforms: vec!["arduino".into()],
        });
    }
    out
}

/// Install a library into the project's PlatformIO-compatible `lib/` folder.
///
/// Uses a temporary Arduino user dir, then moves `{user}/libraries/<Name>` → `{cwd}/lib/<Name>`.
#[tauri::command]
pub fn arduino_cli_lib_install(cwd: String, library: String) -> Result<String, String> {
    let cli = resolve_arduino_cli().ok_or_else(|| {
        "arduino-cli not found on PATH. Install from https://arduino.github.io/arduino-cli/"
            .to_string()
    })?;
    let name = validate_lib_name(&library)?;
    let project = PathBuf::from(&cwd);
    if !project.is_dir() {
        return Err("Project folder not found.".into());
    }
    let ini = project.join("platformio.ini");
    if !ini.is_file() {
        return Err("Open a PlatformIO project (platformio.ini) first.".into());
    }

    let staging = project.join(".aether").join("arduino_user");
    let staging_libs = staging.join("libraries");
    fs::create_dir_all(&staging_libs).map_err(|e| format!("Cannot create staging dir: {e}"))?;

    let mut cmd = Command::new(&cli);
    cmd.args(["lib", "install", name])
        .env("ARDUINO_DIRECTORIES_USER", &staging)
        .current_dir(&project)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    configure_cli_command(&mut cmd);
    let output = cmd
        .output()
        .map_err(|e| format!("Failed to run arduino-cli lib install: {e}"))?;
    if !output.status.success() {
        return Err(failure_detail(&output, "arduino-cli lib install failed."));
    }

    let installed_dir = find_installed_lib_dir(&staging_libs, name)
        .ok_or_else(|| format!("Library installed but folder not found under staging: {name}"))?;

    let lib_root = project.join("lib");
    fs::create_dir_all(&lib_root).map_err(|e| format!("Cannot create lib/: {e}"))?;
    let dest = lib_root.join(
        installed_dir
            .file_name()
            .ok_or_else(|| "Invalid library folder name.".to_string())?,
    );
    if dest.exists() {
        fs::remove_dir_all(&dest).map_err(|e| format!("Cannot replace existing lib: {e}"))?;
    }
    fs::rename(&installed_dir, &dest)
        .or_else(|_| {
            copy_dir_recursive(&installed_dir, &dest).and_then(|_| {
                let _ = fs::remove_dir_all(&installed_dir);
                Ok(())
            })
        })
        .map_err(|e| format!("Failed to move library into lib/: {e}"))?;

    // Best-effort cleanup of staging leftovers.
    let _ = fs::remove_dir_all(&staging);

    Ok(format!("Installed {name} into {}", dest.display()))
}

fn find_installed_lib_dir(libraries: &Path, name: &str) -> Option<PathBuf> {
    if !libraries.is_dir() {
        return None;
    }
    let exact = libraries.join(name);
    if exact.is_dir() {
        return Some(exact);
    }
    // Case-insensitive / spaced name fallback.
    let want = name.to_lowercase().replace(' ', "_");
    let want_spaced = name.to_lowercase();
    let entries = fs::read_dir(libraries).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let folder = entry.file_name().to_string_lossy().to_lowercase();
        if folder == want_spaced || folder.replace(' ', "_") == want {
            return Some(path);
        }
    }
    // If only one new folder exists, use it.
    let dirs: Vec<_> = fs::read_dir(libraries)
        .ok()?
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.is_dir())
        .collect();
    if dirs.len() == 1 {
        return dirs.into_iter().next();
    }
    None
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        if from.is_dir() {
            copy_dir_recursive(&from, &to)?;
        } else {
            fs::copy(&from, &to).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// List library folder names under project `lib/` (arduino-cli installs).
#[tauri::command]
pub fn arduino_cli_lib_list(cwd: String) -> Result<Vec<String>, String> {
    let lib_root = PathBuf::from(&cwd).join("lib");
    if !lib_root.is_dir() {
        return Ok(vec![]);
    }
    let mut names = Vec::new();
    for entry in fs::read_dir(&lib_root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_dir() {
            if let Some(name) = entry.file_name().to_str() {
                if !name.starts_with('.') {
                    names.push(name.to_string());
                }
            }
        }
    }
    names.sort();
    Ok(names)
}

/// Compile / upload / clean via arduino-cli; streams to the same Output events as PlatformIO.
#[tauri::command]
pub fn arduino_cli_run(
    app: AppHandle,
    state: State<'_, PioState>,
    cwd: String,
    task: String,
    env: Option<String>,
    fqbn: Option<String>,
    upload_port: Option<String>,
) -> Result<(), String> {
    let running = state.running_flag();
    if running.load(Ordering::SeqCst) {
        return Err("A firmware task is already running.".into());
    }

    let cli = resolve_arduino_cli().ok_or_else(|| {
        "arduino-cli not found. Install from https://arduino.github.io/arduino-cli/latest/installation/"
            .to_string()
    })?;

    let root = PathBuf::from(&cwd);
    if !root.is_dir() {
        return Err(format!("Workspace folder does not exist: {cwd}"));
    }

    let sketch_dir = find_sketch_dir(&root)?;
    let resolved_fqbn = resolve_fqbn(&root, env.as_deref(), fqbn.as_deref())?;

    let mut args: Vec<String> = Vec::new();
    match task.as_str() {
        "build" => {
            args.push("compile".into());
            args.push("--fqbn".into());
            args.push(resolved_fqbn.clone());
            let lib = root.join("lib");
            if lib.is_dir() {
                args.push("--libraries".into());
                args.push(lib.display().to_string());
            }
            args.push(sketch_dir.display().to_string());
        }
        "upload" => {
            let port = upload_port
                .as_deref()
                .map(str::trim)
                .filter(|p| !p.is_empty())
                .ok_or_else(|| "Upload port is required for arduino-cli upload.".to_string())?;
            if port.contains('\0') || port.len() > 260 {
                return Err("Invalid upload port.".into());
            }
            args.push("upload".into());
            args.push("-p".into());
            args.push(port.to_string());
            args.push("--fqbn".into());
            args.push(resolved_fqbn.clone());
            args.push(sketch_dir.display().to_string());
        }
        "clean" => {
            // compile --clean rebuilds from scratch (arduino-cli has no project clean).
            args.push("compile".into());
            args.push("--clean".into());
            args.push("--fqbn".into());
            args.push(resolved_fqbn.clone());
            let lib = root.join("lib");
            if lib.is_dir() {
                args.push("--libraries".into());
                args.push(lib.display().to_string());
            }
            args.push(sketch_dir.display().to_string());
        }
        "compiledb" => {
            return Err(
                "compile_commands.json is a PlatformIO task. Switch build tool to PlatformIO."
                    .into(),
            );
        }
        other => return Err(format!("Unknown Arduino CLI task: {other}")),
    }

    let child_slot = state.child_slot();
    {
        let mut slot = child_slot.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(mut child) = slot.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    running.store(true, Ordering::SeqCst);

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

    emit_line(&app, "system", format!("cwd: {cwd}"));
    emit_line(&app, "system", format!("fqbn: {resolved_fqbn}"));

    // Verify / auto-install the core for this FQBN (e.g. arduino:avr, esp32:esp32).
    if let Err(e) = ensure_core_for_fqbn(&cli, &resolved_fqbn, &app) {
        running.store(false, Ordering::SeqCst);
        emit_status(
            &app,
            PioStatusPayload {
                running: false,
                task: Some(task.clone()),
                success: Some(false),
                code: None,
                error: Some(e.clone()),
            },
        );
        return Err(e);
    }

    emit_line(
        &app,
        "system",
        format!("> {} {}", cli.display(), args.join(" ")),
    );

    let mut child_cmd = Command::new(&cli);
    child_cmd
        .args(&args)
        .current_dir(&cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null());
    configure_cli_command(&mut child_cmd);
    let mut child = child_cmd.spawn().map_err(|e| {
        running.store(false, Ordering::SeqCst);
        format!("Failed to start arduino-cli: {e}")
    })?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    {
        let mut slot = child_slot.lock().unwrap_or_else(|e| e.into_inner());
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
    let task_name = task.clone();

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_common_avr_and_esp_boards() {
        assert_eq!(pio_board_to_fqbn("uno"), Some("arduino:avr:uno"));
        assert_eq!(pio_board_to_fqbn("megaatmega2560"), Some("arduino:avr:mega"));
        assert_eq!(pio_board_to_fqbn("nanoatmega328"), Some("arduino:avr:nano"));
        assert_eq!(pio_board_to_fqbn("esp32dev"), Some("esp32:esp32:esp32"));
        assert_eq!(pio_board_to_fqbn("unknown-board-xyz"), None);
    }

    #[test]
    fn extracts_platform_from_fqbn() {
        assert_eq!(
            fqbn_platform("arduino:avr:uno").as_deref(),
            Some("arduino:avr")
        );
        assert_eq!(
            fqbn_platform("esp32:esp32:esp32").as_deref(),
            Some("esp32:esp32")
        );
        assert_eq!(fqbn_platform("bad"), None);
    }

    #[test]
    fn detects_installed_core_ids() {
        let installed = vec!["arduino:avr".into(), "esp32:esp32".into()];
        assert!(core_is_installed(&installed, "arduino:avr"));
        assert!(core_is_installed(&installed, "esp32:esp32"));
        assert!(!core_is_installed(&installed, "esp8266:esp8266"));
    }

    #[test]
    fn reads_board_from_env_section() {
        let ini = r#"
[env:mega]
platform = atmelavr
board = megaatmega2560
framework = arduino
"#;
        assert_eq!(
            board_from_ini(ini, Some("mega")).as_deref(),
            Some("megaatmega2560")
        );
        assert_eq!(
            board_from_ini(ini, Some("env:mega")).as_deref(),
            Some("megaatmega2560")
        );
    }
}
