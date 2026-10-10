use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BundledExample {
    pub id: String,
    pub title: String,
    pub description: String,
    pub board: String,
}

const CATALOG: &[(&str, &str, &str, &str)] = &[
    (
        "esp32-blink",
        "ESP32 Blink + libs",
        "ESP32 Dev Module blink sketch with ArduinoJson, ESP32Servo, and FastLED in lib_deps.",
        "esp32dev",
    ),
    (
        "arduino-mega-servo",
        "Arduino Mega Servo",
        "Arduino Mega 2560 servo sweep with ArduinoJson.",
        "megaatmega2560",
    ),
    (
        "arduino-nano",
        "Arduino Nano",
        "Arduino Nano blink + Servo with ArduinoJson.",
        "nanoatmega328",
    ),
];

fn examples_root(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(dir) = app.path().resource_dir() {
        let candidates = [
            dir.join("examples"),
            dir.join("resources").join("examples"),
        ];
        for c in candidates {
            if c.is_dir() {
                return Ok(c);
            }
        }
    }

    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let local = manifest.join("resources").join("examples");
    if local.is_dir() {
        return Ok(local);
    }

    Err("Bundled examples not found. Rebuild the app with example resources.".into())
}

fn copy_dir_filtered(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| format!("mkdir {}: {e}", dst.display()))?;

    for entry in fs::read_dir(src).map_err(|e| format!("read {}: {e}", src.display()))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if name_str == ".pio" || name_str == "compile_commands.json" || name_str == ".git" {
            continue;
        }
        let from = entry.path();
        let to = dst.join(&name);
        let ft = entry.file_type().map_err(|e| e.to_string())?;
        if ft.is_dir() {
            copy_dir_filtered(&from, &to)?;
        } else if ft.is_file() {
            if let Some(parent) = to.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::copy(&from, &to).map_err(|e| format!("copy {}: {e}", from.display()))?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn list_bundled_examples(app: AppHandle) -> Result<Vec<BundledExample>, String> {
    let root = examples_root(&app)?;
    let mut out = Vec::new();
    for (id, title, description, board) in CATALOG {
        if root.join(id).is_dir() {
            out.push(BundledExample {
                id: (*id).to_string(),
                title: (*title).to_string(),
                description: (*description).to_string(),
                board: (*board).to_string(),
            });
        }
    }
    if out.is_empty() {
        return Err(format!("No example projects found under {}", root.display()));
    }
    Ok(out)
}

/// Copy a bundled example into the user's Documents/Aether/examples/<id> and return that path.
#[tauri::command]
pub fn materialize_bundled_example(app: AppHandle, id: String) -> Result<String, String> {
    let id = id.trim();
    if id.is_empty()
        || id.contains('/')
        || id.contains('\\')
        || id.contains("..")
        || !CATALOG.iter().any(|(catalog_id, ..)| *catalog_id == id)
    {
        return Err("Unknown example id.".into());
    }

    let src = examples_root(&app)?.join(id);
    if !src.is_dir() {
        return Err(format!("Example '{id}' is not bundled."));
    }

    let docs = app
        .path()
        .document_dir()
        .map_err(|e| format!("document_dir: {e}"))?;
    let dest = docs.join("Aether").join("examples").join(id);
    if dest.exists() {
        fs::remove_dir_all(&dest)
            .map_err(|e| format!("clear {}: {e}", dest.display()))?;
    }
    copy_dir_filtered(&src, &dest)?;
    Ok(dest.to_string_lossy().to_string())
}
