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
    pub tags: Vec<String>,
}

struct CatalogEntry {
    id: &'static str,
    title: &'static str,
    description: &'static str,
    board: &'static str,
    tags: &'static [&'static str],
}

const CATALOG: &[CatalogEntry] = &[
    CatalogEntry {
        id: "esp32-blink",
        title: "ESP32 Blink",
        description:
            "Blink the built-in LED on an ESP32 Dev Module. Includes ArduinoJson, ESP32Servo, and FastLED in lib_deps.",
        board: "esp32dev",
        tags: &["ESP32", "Blink"],
    },
    CatalogEntry {
        id: "arduino-mega-servo",
        title: "Arduino Mega Servo",
        description: "Servo sweep sketch for Arduino Mega 2560 with ArduinoJson.",
        board: "megaatmega2560",
        tags: &["Mega", "Servo"],
    },
    CatalogEntry {
        id: "arduino-nano",
        title: "Arduino Nano",
        description: "Blink + Servo starter for Arduino Nano (ATmega328) with ArduinoJson.",
        board: "nanoatmega328",
        tags: &["Nano", "Blink", "Servo"],
    },
    CatalogEntry {
        id: "esp32-wifi",
        title: "ESP32 Wi-Fi stub",
        description:
            "Minimal Wi-Fi connect stub for ESP32. Replace SSID/password, then see PlatformIO Wi-Fi docs for next steps.",
        board: "esp32dev",
        tags: &["ESP32", "Wi-Fi"],
    },
    CatalogEntry {
        id: "esp32-cam",
        title: "ESP32-CAM",
        description:
            "AI-Thinker ESP32-CAM starter (board esp32cam). Status LED + Serial Plotter sample lines. Camera stack not included.",
        board: "esp32cam",
        tags: &["ESP32", "CAM"],
    },
    CatalogEntry {
        id: "esp32-lora-tx",
        title: "ESP32 LoRa TX",
        description:
            "RadioLib point-to-point transmitter with pin maps for Heltec / TTGO / T-Beam. Pair with ESP32 LoRa RX; default EU868.",
        board: "heltec_wifi_lora_32_V3",
        tags: &["ESP32", "LoRa", "TX"],
    },
    CatalogEntry {
        id: "esp32-lora-rx",
        title: "ESP32 LoRa RX",
        description:
            "RadioLib point-to-point receiver. Same board env and region/SF as ESP32 LoRa TX.",
        board: "heltec_wifi_lora_32_V3",
        tags: &["ESP32", "LoRa", "RX"],
    },
    CatalogEntry {
        id: "arduino-mega-lora",
        title: "Arduino Mega LoRa",
        description:
            "Mega + RFM95/SX1276 on SPI (NSS=10 DIO0=2 RST=9). RadioLib TX/RX loop; default EU868.",
        board: "megaatmega2560",
        tags: &["Mega", "LoRa"],
    },
    CatalogEntry {
        id: "esp32-lorawan-stub",
        title: "LoRaWAN OTAA (Join + uplink)",
        description:
            "RadioLib OTAA: set DevEUI/AppKey, Join the network, then periodic uplinks. Heltec/TTGO/ESP32 envs; EU868 default.",
        board: "heltec_wifi_lora_32_V3",
        tags: &["ESP32", "LoRaWAN", "TTN", "OTAA"],
    },
    CatalogEntry {
        id: "esp32-espnow-stub",
        title: "ESP-NOW stub",
        description:
            "ESP32 ESP-NOW peer stub with ArduinoJson payloads. Set PEER_MAC to the other board.",
        board: "esp32dev",
        tags: &["ESP32", "ESP-NOW"],
    },
    CatalogEntry {
        id: "meshtastic-stub",
        title: "Meshtastic (stub)",
        description:
            "Placeholder — Meshtastic firmware is not bundled. Use LoRa TX/RX or flash official Meshtastic.",
        board: "heltec_wifi_lora_32_V3",
        tags: &["Meshtastic", "LoRa", "Stub"],
    },
    CatalogEntry {
        id: "pixhawk-ardupilot-stub",
        title: "Pixhawk / ArduPilot (stub)",
        description:
            "Placeholder for ArduPilot / SITL workflows. Not a full autopilot IDE — see README for orientation.",
        board: "sitl",
        tags: &["Pixhawk", "ArduPilot", "Stub"],
    },
    CatalogEntry {
        id: "betaflight-espfc-stub",
        title: "Betaflight / ESP-FC (later)",
        description:
            "Roadmap placeholder. Full Betaflight / ESP-FC scaffolding is not bundled yet — README only.",
        board: "—",
        tags: &["Betaflight", "ESP-FC", "Later"],
    },
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
    for entry in CATALOG {
        if root.join(entry.id).is_dir() {
            out.push(BundledExample {
                id: entry.id.to_string(),
                title: entry.title.to_string(),
                description: entry.description.to_string(),
                board: entry.board.to_string(),
                tags: entry.tags.iter().map(|s| (*s).to_string()).collect(),
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
        || !CATALOG.iter().any(|e| e.id == id)
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
