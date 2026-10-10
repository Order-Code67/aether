use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Wry};

const MENU_EVENT: &str = "menu-command";

pub fn build_menu(app: &AppHandle<Wry>) -> tauri::Result<Menu<Wry>> {
    let file = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &MenuItem::with_id(app, "file.openFolder", "Open Folder…", true, Some("CmdOrCtrl+O"))?,
            &MenuItem::with_id(app, "file.addFolder", "Add Folder to Workspace…", true, None::<&str>)?,
            &MenuItem::with_id(app, "file.newProject", "New Project…", true, None::<&str>)?,
            &MenuItem::with_id(app, "file.openExample", "Open Example…", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "file.save", "Save", true, Some("CmdOrCtrl+S"))?,
            &MenuItem::with_id(app, "file.saveAll", "Save All", true, Some("CmdOrCtrl+Shift+S"))?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "file.closeWorkspace", "Close Workspace", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, Some("Exit"))?,
        ],
    )?;

    let edit = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "edit.find", "Find", true, Some("CmdOrCtrl+F"))?,
            &MenuItem::with_id(app, "edit.replace", "Replace", true, Some("CmdOrCtrl+H"))?,
        ],
    )?;

    let view = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &MenuItem::with_id(
                app,
                "view.commandPalette",
                "Command Palette…",
                true,
                Some("CmdOrCtrl+Shift+P"),
            )?,
            &MenuItem::with_id(app, "file.quickOpen", "Go to File…", true, Some("CmdOrCtrl+P"))?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "view.explorer", "Explorer", true, None::<&str>)?,
            &MenuItem::with_id(app, "view.search", "Search", true, Some("CmdOrCtrl+Shift+F"))?,
            &MenuItem::with_id(
                app,
                "view.sourceControl",
                "Source Control",
                true,
                Some("CmdOrCtrl+Shift+G"),
            )?,
            &MenuItem::with_id(app, "view.debug", "Run and Debug", true, Some("CmdOrCtrl+Shift+D"))?,
            &MenuItem::with_id(app, "view.extensions", "Extensions", true, Some("CmdOrCtrl+Shift+X"))?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "view.terminal", "Toggle Terminal", true, None::<&str>)?,
            &MenuItem::with_id(app, "view.togglePanel", "Toggle Bottom Panel", true, None::<&str>)?,
            &MenuItem::with_id(app, "settings.open", "Settings…", true, Some("CmdOrCtrl+,"))?,
        ],
    )?;

    let run = Submenu::with_items(
        app,
        "Run",
        true,
        &[
            &MenuItem::with_id(app, "pio.build", "Build", true, Some("CmdOrCtrl+Shift+B"))?,
            &MenuItem::with_id(app, "pio.upload", "Upload", true, Some("CmdOrCtrl+Alt+U"))?,
            &MenuItem::with_id(app, "pio.clean", "Clean", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "debug.start", "Start Debugging", true, Some("F5"))?,
            &MenuItem::with_id(app, "debug.stop", "Stop Debugging", true, Some("Shift+F5"))?,
        ],
    )?;

    let help = Submenu::with_items(
        app,
        "Help",
        true,
        &[
            &MenuItem::with_id(app, "pio.doctor", "Check Tools…", true, None::<&str>)?,
            &MenuItem::with_id(
                app,
                "help.checkUpdates",
                "Check for Updates…",
                true,
                None::<&str>,
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(
                app,
                "settings.about",
                "About Aether",
                true,
                None::<&str>,
            )?,
        ],
    )?;

    Menu::with_items(app, &[&file, &edit, &view, &run, &help])
}

pub fn attach_menu(app: &AppHandle<Wry>) -> tauri::Result<()> {
    let menu = build_menu(app)?;
    app.set_menu(menu)?;
    Ok(())
}

pub fn emit_menu_command(app: &AppHandle, id: &str) {
    // Skip predefined items that have empty / system ids we don't map
    if id.is_empty() || id == "undo" || id == "redo" || id.contains("separator") {
        return;
    }
    let _ = app.emit(MENU_EVENT, id.to_string());
}
