use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

const AI_CHUNK_EVENT: &str = "ai-chunk";
const AI_STATUS_EVENT: &str = "ai-status";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatRequest {
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub messages: Vec<AiMessage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChunkPayload {
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiStatusPayload {
    pub running: bool,
    pub cancelled: bool,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
struct ChatCompletionsBody {
    model: String,
    messages: Vec<AiMessage>,
    temperature: f32,
    stream: bool,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionsResponse {
    choices: Option<Vec<ChatChoice>>,
    error: Option<ApiErrorBody>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: Option<AiMessage>,
    delta: Option<StreamDelta>,
}

#[derive(Debug, Deserialize)]
struct StreamDelta {
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ApiErrorBody {
    message: Option<String>,
}

pub struct AiState {
    cancel: Arc<AtomicBool>,
    running: Arc<AtomicBool>,
}

impl Default for AiState {
    fn default() -> Self {
        Self {
            cancel: Arc::new(AtomicBool::new(false)),
            running: Arc::new(AtomicBool::new(false)),
        }
    }
}

fn normalize_base_url(base_url: &str) -> String {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.ends_with("/chat/completions") {
        trimmed.to_string()
    } else if trimmed.ends_with("/v1") {
        format!("{trimmed}/chat/completions")
    } else {
        format!("{trimmed}/v1/chat/completions")
    }
}

fn validate_request(request: &AiChatRequest) -> Result<(), String> {
    if request.api_key.trim().is_empty() {
        return Err("API key is empty. Set it in Agent settings.".into());
    }
    if request.model.trim().is_empty() {
        return Err("Model name is empty.".into());
    }
    if request.messages.is_empty() {
        return Err("No messages to send.".into());
    }
    Ok(())
}

fn emit_status(app: &AppHandle, status: AiStatusPayload) {
    let _ = app.emit(AI_STATUS_EVENT, status);
}

fn emit_chunk(app: &AppHandle, text: String) {
    if text.is_empty() {
        return;
    }
    let _ = app.emit(AI_CHUNK_EVENT, AiChunkPayload { text });
}

#[tauri::command]
pub async fn ai_chat_completion(request: AiChatRequest) -> Result<String, String> {
    validate_request(&request)?;

    let url = normalize_base_url(&request.base_url);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    let body = ChatCompletionsBody {
        model: request.model,
        messages: request.messages,
        temperature: 0.2,
        stream: false,
    };

    let response = client
        .post(&url)
        .bearer_auth(request.api_key.trim())
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {e}"))?;

    if !status.is_success() {
        return Err(format_api_error(status, &text));
    }

    let parsed: ChatCompletionsResponse =
        serde_json::from_str(&text).map_err(|e| format!("Invalid API JSON: {e}"))?;

    if let Some(err) = parsed.error.and_then(|e| e.message) {
        return Err(err);
    }

    parsed
        .choices
        .and_then(|mut c| c.pop())
        .and_then(|c| c.message)
        .map(|m| m.content)
        .filter(|c| !c.is_empty())
        .ok_or_else(|| "API returned an empty assistant message.".into())
}

#[tauri::command]
pub async fn ai_chat_stream(
    app: AppHandle,
    state: State<'_, AiState>,
    request: AiChatRequest,
) -> Result<(), String> {
    validate_request(&request)?;

    if state.running.swap(true, Ordering::SeqCst) {
        return Err("An agent request is already running.".into());
    }
    state.cancel.store(false, Ordering::SeqCst);

    emit_status(
        &app,
        AiStatusPayload {
            running: true,
            cancelled: false,
            error: None,
        },
    );

    let result = run_stream(&app, &state, request).await;

    let cancelled = state.cancel.load(Ordering::SeqCst);
    state.running.store(false, Ordering::SeqCst);
    state.cancel.store(false, Ordering::SeqCst);

    match result {
        Ok(()) => {
            emit_status(
                &app,
                AiStatusPayload {
                    running: false,
                    cancelled,
                    error: None,
                },
            );
            Ok(())
        }
        Err(error) => {
            emit_status(
                &app,
                AiStatusPayload {
                    running: false,
                    cancelled,
                    error: Some(error.clone()),
                },
            );
            Err(error)
        }
    }
}

async fn run_stream(
    app: &AppHandle,
    state: &State<'_, AiState>,
    request: AiChatRequest,
) -> Result<(), String> {
    let url = normalize_base_url(&request.base_url);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(180))
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    let body = ChatCompletionsBody {
        model: request.model,
        messages: request.messages,
        temperature: 0.2,
        stream: true,
    };

    let response = client
        .post(&url)
        .bearer_auth(request.api_key.trim())
        .header("Content-Type", "application/json")
        .header("Accept", "text/event-stream")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;

    let status = response.status();
    if !status.is_success() {
        let text = response
            .text()
            .await
            .unwrap_or_else(|_| String::new());
        return Err(format_api_error(status, &text));
    }

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(item) = stream.next().await {
        if state.cancel.load(Ordering::SeqCst) {
            return Ok(());
        }

        let chunk = item.map_err(|e| format!("Stream read error: {e}"))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(idx) = buffer.find('\n') {
            let mut line = buffer[..idx].to_string();
            buffer.drain(..=idx);
            if line.ends_with('\r') {
                line.pop();
            }

            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with(':') {
                continue;
            }
            let Some(data) = trimmed.strip_prefix("data:") else {
                continue;
            };
            let data = data.trim();
            if data == "[DONE]" {
                return Ok(());
            }

            if let Ok(parsed) = serde_json::from_str::<ChatCompletionsResponse>(data) {
                if let Some(err) = parsed.error.and_then(|e| e.message) {
                    return Err(err);
                }
                if let Some(choices) = parsed.choices {
                    for choice in choices {
                        if let Some(delta) = choice.delta.and_then(|d| d.content) {
                            emit_chunk(app, delta);
                        }
                    }
                }
            }
        }
    }

    Ok(())
}

fn format_api_error(status: reqwest::StatusCode, text: &str) -> String {
    let parsed: Result<ChatCompletionsResponse, _> = serde_json::from_str(text);
    if let Ok(err_body) = parsed {
        if let Some(err) = err_body.error.and_then(|e| e.message) {
            return format!("API {status}: {err}");
        }
    }
    let snippet: String = text.chars().take(400).collect();
    format!("API {status}: {snippet}")
}

#[tauri::command]
pub fn ai_cancel(state: State<'_, AiState>) -> Result<(), String> {
    if state.running.load(Ordering::SeqCst) {
        state.cancel.store(true, Ordering::SeqCst);
    }
    Ok(())
}
