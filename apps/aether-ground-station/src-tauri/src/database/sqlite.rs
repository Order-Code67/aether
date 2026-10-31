use directories::ProjectDirs;
use rusqlite::{params, Connection};
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

pub struct DbState {
    pub conn: Mutex<Option<Connection>>,
}

impl Default for DbState {
    fn default() -> Self {
        Self {
            conn: Mutex::new(None),
        }
    }
}

fn db_path() -> Result<PathBuf, String> {
    let dirs = ProjectDirs::from("com", "aether", "ground-station")
        .ok_or_else(|| "Не удалось определить каталог данных".to_string())?;
    let dir = dirs.data_dir();
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    Ok(dir.join("ags.sqlite"))
}

#[tauri::command]
pub fn db_init(state: State<'_, DbState>) -> Result<String, String> {
    let path = db_path()?;
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS profiles (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          payload TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS workspace_layouts (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          payload TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS event_log (
          id TEXT PRIMARY KEY,
          at TEXT NOT NULL,
          severity TEXT NOT NULL,
          source TEXT NOT NULL,
          message TEXT NOT NULL,
          details TEXT
        );
        CREATE TABLE IF NOT EXISTS archive_clips (
          id TEXT PRIMARY KEY,
          payload TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS settings_kv (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
        "#,
    )
    .map_err(|e| e.to_string())?;
    let mut guard = state.conn.lock().map_err(|_| "DB lock".to_string())?;
    *guard = Some(conn);
    Ok(path.to_string_lossy().to_string())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbEvent {
    pub id: String,
    pub at: String,
    pub severity: String,
    pub source: String,
    pub message: String,
}

#[tauri::command]
pub fn db_append_event(
    state: State<'_, DbState>,
    id: String,
    at: String,
    severity: String,
    source: String,
    message: String,
) -> Result<(), String> {
    let guard = state.conn.lock().map_err(|_| "DB lock".to_string())?;
    let conn = guard.as_ref().ok_or_else(|| "БД не инициализирована".to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO event_log (id, at, severity, source, message, details) VALUES (?1,?2,?3,?4,?5,NULL)",
        params![id, at, severity, source, message],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_list_events(state: State<'_, DbState>, limit: i64) -> Result<Vec<DbEvent>, String> {
    let guard = state.conn.lock().map_err(|_| "DB lock".to_string())?;
    let conn = guard.as_ref().ok_or_else(|| "БД не инициализирована".to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, at, severity, source, message FROM event_log ORDER BY at DESC LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![limit], |row| {
            Ok(DbEvent {
                id: row.get(0)?,
                at: row.get(1)?,
                severity: row.get(2)?,
                source: row.get(3)?,
                message: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
pub fn db_upsert_setting(
    state: State<'_, DbState>,
    key: String,
    value: String,
) -> Result<(), String> {
    if key.to_lowercase().contains("password") || key.to_lowercase().contains("secret") {
        // Reject plaintext secret storage via this API
        if !value.starts_with("enc:") {
            return Err("Секреты нельзя сохранять открытым текстом".into());
        }
    }
    let guard = state.conn.lock().map_err(|_| "DB lock".to_string())?;
    let conn = guard.as_ref().ok_or_else(|| "БД не инициализирована".to_string())?;
    conn.execute(
        "INSERT INTO settings_kv(key, value) VALUES(?1,?2)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_get_setting(state: State<'_, DbState>, key: String) -> Result<Option<String>, String> {
    let guard = state.conn.lock().map_err(|_| "DB lock".to_string())?;
    let conn = guard.as_ref().ok_or_else(|| "БД не инициализирована".to_string())?;
    let mut stmt = conn
        .prepare("SELECT value FROM settings_kv WHERE key=?1")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt.query(params![key]).map_err(|e| e.to_string())?;
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        Ok(Some(row.get(0).map_err(|e| e.to_string())?))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn db_backup(state: State<'_, DbState>) -> Result<String, String> {
    let path = db_path()?;
    let backup = path.with_extension("sqlite.bak");
    let guard = state.conn.lock().map_err(|_| "DB lock".to_string())?;
    let _conn = guard.as_ref().ok_or_else(|| "БД не инициализирована".to_string())?;
    drop(guard);
    std::fs::copy(&path, &backup).map_err(|e| e.to_string())?;
    Ok(backup.to_string_lossy().to_string())
}
