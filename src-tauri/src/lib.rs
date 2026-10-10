mod ai;
mod debug;
mod git;
mod lsp;
mod menu;
mod platformio;
mod search;
mod serial;
mod terminal;
mod watcher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .manage(serial::SerialState::default())
        .manage(terminal::TerminalState::default())
        .manage(platformio::PioState::default())
        .manage(watcher::WatcherState::default())
        .manage(ai::AiState::default())
        .manage(lsp::LspState::default())
        .manage(debug::DebugState::default())
        .setup(|app| {
            #[cfg(any(target_os = "macos", windows, target_os = "linux"))]
            {
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
            }
            menu::attach_menu(app.handle())?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            menu::emit_menu_command(app, event.id().as_ref());
        })
        .invoke_handler(tauri::generate_handler![
            serial::serial_list_ports,
            serial::serial_open,
            serial::serial_close,
            serial::serial_write,
            serial::serial_get_status,
            terminal::terminal_create,
            terminal::terminal_write,
            terminal::terminal_resize,
            terminal::terminal_close,
            platformio::pio_detect,
            platformio::pio_inspect_project,
            platformio::pio_run,
            platformio::pio_cancel,
            platformio::pio_is_running,
            platformio::pio_project_init,
            ai::ai_chat_completion,
            ai::ai_chat_stream,
            ai::ai_cancel,
            watcher::watch_start,
            watcher::watch_stop,
            watcher::watch_sync,
            search::search_workspace,
            git::git_detect,
            git::git_status,
            git::git_stage,
            git::git_unstage,
            git::git_discard,
            git::git_commit,
            git::git_diff,
            git::git_branches,
            git::git_checkout,
            git::git_create_branch,
            git::git_fetch,
            git::git_pull,
            git::git_push,
            lsp::lsp_detect,
            lsp::lsp_start,
            lsp::lsp_stop,
            lsp::lsp_status,
            lsp::lsp_notify,
            lsp::lsp_request,
            lsp::lsp_path_to_uri,
            debug::debug_status,
            debug::debug_start,
            debug::debug_stop,
            debug::debug_continue,
            debug::debug_pause,
            debug::debug_step_over,
            debug::debug_step_into,
            debug::debug_step_out,
            debug::debug_insert_breakpoint,
            debug::debug_delete_breakpoint,
            debug::debug_stack,
            debug::debug_variables,
            debug::debug_eval,
            debug::debug_console_input,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Aether");
}
