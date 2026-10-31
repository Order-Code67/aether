mod commands;
mod database;
mod hardware;
mod network;
mod video;

use database::sqlite::DbState;
use hardware::serial::SerialState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(SerialState::default())
        .manage(DbState::default())
        .setup(|app| {
            let state = app.state::<DbState>();
            let _ = database::sqlite::open_and_migrate(&state);
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
            database::sqlite::db_upsert_json,
            database::sqlite::db_get_json,
            database::sqlite::db_list_users,
            database::sqlite::db_verify_user_password,
            database::sqlite::db_upsert_recording,
            database::sqlite::db_list_recordings,
            database::sqlite::db_audit,
        ])
        .run(tauri::generate_context!())
        .expect("ошибка запуска Aether Ground Station");
}
