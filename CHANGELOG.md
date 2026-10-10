# Changelog

## 0.2.5 — 2026-10-10

- **Install missing tools** — Tools Doctor can install missing PlatformIO / toolchain pieces from the banner
- **Upload progress & errors** — clearer upload progress plus friendly COM port / driver error decoding
- **Libraries** — install progress, favorites / recent, and an ESP32Servo hint when the Servo library is a poor fit

## 0.2.4 — 2026-10-10

- **New Project wizard** — guided project creation (board / framework) from Explorer and File menu
- **Tools Doctor** — startup check for PlatformIO / toolchain readiness with a clear banner when something is missing
- **Upload / COM port** — clearer port selection and Upload UX when flashing firmware

## 0.2.3 — 2026-10-10

- **Bundled examples** — ESP32 Blink, Arduino Mega Servo, and Arduino Nano ship with the install (File → Open Example… / welcome **Примеры**); copies into `Documents/Aether/examples`
- **Library presets** — example `platformio.ini` files include common `lib_deps` (ArduinoJson, Servo / ESP32Servo, FastLED)
- Includes prior library-manager and icon fixes from 0.2.x

## 0.2.2 — 2026-10-10

- **App icon** — corrected branding: robot hand holding planet (not robot book); regenerated `src-tauri/icons/*` and About UI `public/aether-icon.png`

## 0.2.1 — 2026-10-10

- **App icon** — new robot-book / planet branding (Tauri `src-tauri/icons/*`)
- **Typing / focus** — editor and input focus fixes carried forward
- **Libraries** — Arduino-framework install/search fix; broader “Arduino” chip (framework=arduino, not AVR-only)
- **Libraries UI** — clearer RU helper steps, Activity Bar tooltip (книга/библиотеки), real error messages via `errorMessage`

## 0.2.0 — 2026-10-10

- **i18n** — Russian / English (Settings → General)
- **Sketch encryption** — AES-GCM password lock for source files
- **Libraries** — PlatformIO registry search & install (Arduino-like manager)
- Input/focus fixes for Monaco + hidden terminal stdin

## 0.1.0 — 2026-10-10

First Windows desktop release.

- IDE chrome: Activity Bar, Sidebar, Editor, Bottom Panel, Status Bar
- Monaco editor, tabs, Find/Replace, Settings
- PlatformIO: Build / Upload / Clean, Problems, IntelliSense (clangd)
- Serial Monitor, integrated Terminal (ConPTY)
- Multi-root workspace, file watcher, Search, Git SCM + merge conflicts
- Debugger (GDB MI via `pio debug`)
- AI Agent (OpenAI-compatible streaming + apply edits)
- Extensions: built-in packs, Marketplace, local publishing hub
- Command Palette / Quick Open, native app menu
- Auto-updater (signed Tauri artifacts + `latest.json` feed)
