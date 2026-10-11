mod dfu;
mod serial;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(serial::SerialState::default())
        .manage(dfu::DfuState::default())
        .setup(|_app| Ok(()))
        .invoke_handler(tauri::generate_handler![
            serial::serial_list_ports,
            serial::serial_open,
            serial::serial_close,
            serial::serial_write,
            serial::serial_write_bytes,
            serial::serial_get_status,
            dfu::dfu_util_detect,
            dfu::dfu_list_devices,
            dfu::dfu_flash_hex,
            get_cli_args,
        ])
        .run(tauri::generate_context!())
        .expect("error while running БПЛА-Студия");
}

#[tauri::command]
fn get_cli_args() -> Vec<String> {
    std::env::args().collect()
}
