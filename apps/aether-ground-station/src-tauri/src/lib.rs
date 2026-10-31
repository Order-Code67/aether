mod commands;
mod database;
mod hardware;
mod network;
mod video;

use database::sqlite::DbState;
use hardware::serial::SerialState;
use rusqlite::Connection;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(SerialState::default())
        .manage(DbState::default())
        .setup(|app| {
            use directories::ProjectDirs;
            use tauri::Manager;
            if let Some(dirs) = ProjectDirs::from("com", "aether", "ground-station") {
                let dir = dirs.data_dir();
                let _ = std::fs::create_dir_all(dir);
                let path = dir.join("ags.sqlite");
                if let Ok(conn) = Connection::open(&path) {
                    let _ = conn.execute_batch(
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
                    );
                    let state = app.state::<DbState>();
                    if let Ok(mut guard) = state.conn.lock() {
                        *guard = Some(conn);
                    };
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app::get_app_info,
            hardware::serial::serial_list_ports,
            hardware::serial::serial_open,
            hardware::serial::serial_close,
            hardware::serial::serial_write,
            hardware::serial::serial_write_bytes,
            hardware::serial::serial_get_status,
            hardware::usb::list_usb_devices,
            hardware::ethernet::list_network_interfaces,
            hardware::ethernet::probe_host,
            database::sqlite::db_init,
            database::sqlite::db_append_event,
            database::sqlite::db_list_events,
            database::sqlite::db_upsert_setting,
            database::sqlite::db_get_setting,
            database::sqlite::db_backup,
        ])
        .run(tauri::generate_context!())
        .expect("ошибка запуска Aether Ground Station");
}
