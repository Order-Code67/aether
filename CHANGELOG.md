# Changelog

## Unreleased

## 0.2.9 — 2026-10-11

- **Welcome PCB backdrop** — subtle animated circuit / microchip background on the Welcome screen (paused when the tab is hidden)
- **GitHub libraries** — Libraries panel: install from `owner/repo` or `https://github.com/…` (#branch) via PlatformIO `lib_deps` / `pio pkg install`
- **VS Code integration** — Open folder in VS Code; generate / merge `.vscode` helpers (PlatformIO extension + IntelliSense hints); File menu, Command Palette, Settings → Tools, Welcome

## 0.2.8 — 2026-10-10

- **Serial Plotter** — live numeric charts from serial (`temp:23.5`, `value=12`, or CSV); pause / clear / per-channel toggles in the bottom panel
- **Hardware profiles** — Pixhawk / ArduPilot, Betaflight / ESPFC, and ESP32-CAM stubs in Examples; New Project wizard points to them
- **Debug gutter & toolbar** — editor breakpoint gutter (persisted per file), Debug toolbar / panel for `pio debug` sessions
- **Multi-env switcher** — pick the active PlatformIO env from the Build toolbar / Status Bar when `platformio.ini` has several envs

## 0.2.7 — 2026-10-10

- **Focus reliability** — Monaco / Search / Terminal focus policy; bottom panel stays mounted when collapsed; Vitest guards + `docs/FOCUS_SMOKE.md`
- **Support report** — Help / About / Command Palette: Copy Support Report to clipboard (RU/EN)
- **Quiet updates** — startup check without modal spam when up-to-date; update dialog with RU changelog notes; Settings shows last check result

## 0.2.6 — 2026-10-10

- **Sketch mode** — Arduino-like Explorer (default ON for PlatformIO): emphasize main sketch, hide `.pio` clutter, optional “Show all files”, auto-open `src/main.cpp`
- **Board / port memory** — per-project env + upload port persistence; auto-detect COM on open and before upload
- **Examples catalog** — card UI with RU/EN descriptions and board tags; ESP32 Wi-Fi stub example
- **Offline cache** — Settings → Tools: detect `~/.platformio` platforms and pre-download espressif32 + atmelavr (streams to Output). To reuse toolchains across machines, copy the entire `~/.platformio` folder (see `docs/OFFLINE_CACHE.md`). Toolchains are **not** embedded in the NSIS installer.

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
