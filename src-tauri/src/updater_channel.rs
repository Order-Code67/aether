//! Channel-aware update checks (stable / beta) using dynamic updater endpoints.

use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

const STABLE_ENDPOINT: &str =
    "https://github.com/Order-Code67/aether/releases/latest/download/latest.json";
const BETA_ENDPOINT: &str =
    "https://github.com/Order-Code67/aether/releases/latest/download/latest-beta.json";

const PROGRESS_EVENT: &str = "updater-download-progress";

pub struct PendingUpdateState {
    #[cfg(any(target_os = "macos", windows, target_os = "linux"))]
    pub inner: Mutex<Option<tauri_plugin_updater::Update>>,
    #[cfg(not(any(target_os = "macos", windows, target_os = "linux")))]
    pub inner: Mutex<Option<()>>,
}

impl Default for PendingUpdateState {
    fn default() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelUpdateInfo {
    pub current_version: String,
    pub version: String,
    pub date: Option<String>,
    pub body: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadProgressPayload {
    downloaded: u64,
    content_length: Option<u64>,
}

fn endpoint_for_channel(channel: &str) -> &'static str {
    match channel {
        "beta" => BETA_ENDPOINT,
        _ => STABLE_ENDPOINT,
    }
}

/// Check for updates using the Stable or Beta feed JSON.
#[cfg(any(target_os = "macos", windows, target_os = "linux"))]
#[tauri::command]
pub async fn updater_check_channel(
    app: AppHandle,
    state: State<'_, PendingUpdateState>,
    channel: String,
) -> Result<Option<ChannelUpdateInfo>, String> {
    use tauri_plugin_updater::UpdaterExt;

    let endpoint = endpoint_for_channel(channel.trim());
    let url = endpoint
        .parse()
        .map_err(|e| format!("Invalid updater endpoint: {e}"))?;

    let updater = app
        .updater_builder()
        .endpoints(vec![url])
        .map_err(|e| e.to_string())?
        .build()
        .map_err(|e| e.to_string())?;

    let update = updater.check().await.map_err(|e| e.to_string())?;
    let Some(update) = update else {
        if let Ok(mut slot) = state.inner.lock() {
            *slot = None;
        }
        return Ok(None);
    };

    let info = ChannelUpdateInfo {
        current_version: update.current_version.clone(),
        version: update.version.clone(),
        date: update.date.map(|d| d.to_string()),
        body: update.body.clone(),
    };

    {
        let mut slot = state.inner.lock().map_err(|e| e.to_string())?;
        *slot = Some(update);
    }
    Ok(Some(info))
}

/// Download and install the pending update from the last channel check.
#[cfg(any(target_os = "macos", windows, target_os = "linux"))]
#[tauri::command]
pub async fn updater_install_pending(
    app: AppHandle,
    state: State<'_, PendingUpdateState>,
) -> Result<(), String> {
    let update = {
        let mut slot = state.inner.lock().map_err(|e| e.to_string())?;
        slot.take()
            .ok_or_else(|| "No update queued. Check for updates first.".to_string())?
    };

    let mut downloaded: u64 = 0;
    update
        .download_and_install(
            |chunk_len, content_length| {
                downloaded = downloaded.saturating_add(chunk_len as u64);
                let _ = app.emit(
                    PROGRESS_EVENT,
                    DownloadProgressPayload {
                        downloaded,
                        content_length,
                    },
                );
            },
            || {},
        )
        .await
        .map_err(|e| e.to_string())
}

#[cfg(not(any(target_os = "macos", windows, target_os = "linux")))]
#[tauri::command]
pub async fn updater_check_channel(
    _app: AppHandle,
    _state: State<'_, PendingUpdateState>,
    _channel: String,
) -> Result<Option<ChannelUpdateInfo>, String> {
    Err("Updater is not available on this platform.".into())
}

#[cfg(not(any(target_os = "macos", windows, target_os = "linux")))]
#[tauri::command]
pub async fn updater_install_pending(
    _app: AppHandle,
    _state: State<'_, PendingUpdateState>,
) -> Result<(), String> {
    Err("Updater is not available on this platform.".into())
}
