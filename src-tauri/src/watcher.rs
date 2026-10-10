use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

const FS_CHANGED_EVENT: &str = "fs-changed";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FsChangedPayload {
    pub root: String,
    pub paths: Vec<String>,
}

struct WatchSession {
    _watcher: RecommendedWatcher,
    stop: Arc<AtomicBool>,
}

pub struct WatcherState {
    sessions: Mutex<HashMap<String, WatchSession>>,
}

impl Default for WatcherState {
    fn default() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

fn should_ignore(path: &Path) -> bool {
    for component in path.components() {
        let name = component.as_os_str().to_string_lossy();
        match name.as_ref() {
            ".git" | ".svn" | ".hg" | ".pio" | ".vscode" | ".idea" | "node_modules"
            | "dist" | "build" | "out" | "target" | "__pycache__" | ".cache" => {
                return true;
            }
            _ => {}
        }
    }
    false
}

fn stop_session(session: WatchSession) {
    session.stop.store(true, Ordering::SeqCst);
}

fn start_one(app: &AppHandle, root: String) -> Result<WatchSession, String> {
    let root_path = PathBuf::from(&root);
    if !root_path.is_dir() {
        return Err(format!("Not a directory: {root}"));
    }

    let stop = Arc::new(AtomicBool::new(false));
    let stop_flag = Arc::clone(&stop);
    let pending: Arc<Mutex<HashSet<String>>> = Arc::new(Mutex::new(HashSet::new()));
    let pending_push = Arc::clone(&pending);
    let root_for_emit = root.clone();

    let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        if stop_flag.load(Ordering::SeqCst) {
            return;
        }
        let Ok(event) = res else {
            return;
        };
        let mut set = pending_push.lock().unwrap_or_else(|e| e.into_inner());
        for path in event.paths {
            if should_ignore(&path) {
                continue;
            }
            set.insert(path.to_string_lossy().to_string());
        }
    })
    .map_err(|e| format!("Failed to create watcher: {e}"))?;

    watcher
        .watch(&root_path, RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch folder: {e}"))?;

    let stop_poll = Arc::clone(&stop);
    let pending_poll = Arc::clone(&pending);
    let app_poll = app.clone();
    thread::spawn(move || {
        let mut last_emit = Instant::now() - Duration::from_secs(1);
        while !stop_poll.load(Ordering::SeqCst) {
            thread::sleep(Duration::from_millis(200));
            if last_emit.elapsed() < Duration::from_millis(350) {
                continue;
            }
            let paths: Vec<String> = {
                let mut set = pending_poll.lock().unwrap_or_else(|e| e.into_inner());
                if set.is_empty() {
                    continue;
                }
                set.drain().collect()
            };
            last_emit = Instant::now();
            let _ = app_poll.emit(
                FS_CHANGED_EVENT,
                FsChangedPayload {
                    root: root_for_emit.clone(),
                    paths,
                },
            );
        }
    });

    Ok(WatchSession {
        _watcher: watcher,
        stop,
    })
}

/// Replace the watched roots with exactly `roots` (multi-root workspace).
#[tauri::command]
pub fn watch_sync(app: AppHandle, state: State<'_, WatcherState>, roots: Vec<String>) -> Result<(), String> {
    let mut map = state.sessions.lock().unwrap_or_else(|e| e.into_inner());
    let desired: HashSet<String> = roots.into_iter().collect();

    let stale: Vec<String> = map
        .keys()
        .filter(|k| !desired.contains(*k))
        .cloned()
        .collect();
    for key in stale {
        if let Some(session) = map.remove(&key) {
            stop_session(session);
        }
    }

    for root in desired {
        if map.contains_key(&root) {
            continue;
        }
        let session = start_one(&app, root.clone())?;
        map.insert(root, session);
    }

    Ok(())
}

#[tauri::command]
pub fn watch_start(app: AppHandle, state: State<'_, WatcherState>, root: String) -> Result<(), String> {
    watch_sync(app, state, vec![root])
}

#[tauri::command]
pub fn watch_stop(state: State<'_, WatcherState>) -> Result<(), String> {
    let mut map = state.sessions.lock().unwrap_or_else(|e| e.into_inner());
    for (_, session) in map.drain() {
        stop_session(session);
    }
    Ok(())
}
