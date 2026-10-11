# Changelog

## Unreleased

## 0.2.20 — 2026-10-11

- **MAVLink Telemetry HUD** — Plotter MAVLink mode expands beyond HEARTBEAT/ATTITUDE: GPS_RAW_INT / GLOBAL_POSITION_INT (lat/lon/alt/fix/sats), SYS_STATUS + BATTERY_STATUS (%, V, A), VFR_HUD (speed/heading/throttle/alt); HUD strip above plots; channels for alt, speed, battery, roll/pitch/yaw; unit tests; RU/EN — still not a GCS / map / missions
- **ESP32-CAM** — bundled example: proper AI-Thinker init, `/capture` JPEG + `/stream` MJPEG, Serial Capture/Stream URLs, 5 V / brownout notes in README + sketch; Camera panel RU/EN power hint when env/URL looks like ESP32-CAM

## 0.2.19 — 2026-10-11

- **Playwright E2E** — `@playwright/test` smoke against Vite preview (Welcome, Settings, Command Palette); `npm run test:e2e`; Vitest contracts moved to `npm run test:contracts`; expanded `docs/E2E_SMOKE.md` checklist (Monaco, Search, Terminal, VS Code, Upload/Serial, Quick Start, Libraries, Camera/Plotter)

## 0.2.18 — 2026-10-11

- **Firmware profiles export/import** — Settings + Command Palette: export selected/all profiles to JSON (`Documents/Aether/profiles`); import with replace or merge; schema validation; RU/EN errors; localStorage unchanged
- **Serial Plotter** — clearer Pause badge; horizontal zoom (+/− / Ctrl+wheel) and pan; reset zoom; export visible or all samples as CSV
- **Camera** — save current frame (PNG/JPEG); record N-frame series to a folder; auto-reconnect with backoff + “Reconnecting…”; optional keep last good frame on Wi‑Fi drop
- **Debug watches & conditions** — Watch panel evaluates expressions when paused via GDB; per-breakpoint condition (Debug panel / context menu); continue when condition is false (best-effort)

## 0.2.17 — 2026-10-11

- **Quick Start on first launch** — desktop app opens the Quick Start wizard once when `onboardingDone` is unset; skip/complete still persisted (0.2.12+); Welcome / Help / Palette unchanged
- **Real Beta channel** — Stable feed (`latest.json`) stays on non-prerelease; Beta (`latest-beta.json`) points at a genuine prerelease (e.g. `v0.2.17-beta.1`) with its own signed installer; update dialog shows a **Beta** badge; see `docs/UPDATES.md`
- **Settings Editor / Agent RU** — all Editor and Agent tab labels/hints/options wired through i18n (en + ru)
- **Arduino libraries via arduino-cli** — Libraries → Arduino detects `arduino-cli` on PATH; search/install into project `lib/` (PlatformIO-compatible); without CLI falls back to PlatformIO `framework=arduino` registry with install hint

## 0.2.16 — 2026-10-11

- **UI audit / menu wiring** — View menu covers Boards, Libraries, AI, Problems, Output, Serial, Plotter, Camera, Debug Console; every native menu id is covered by the command registry (parity test)
- **Command failures surface** — unknown menu/palette ids and thrown command errors show RU/EN status notices instead of silent no-ops
- **Debug Start** — missing project / desktop / already-running cases open the Debug panel and flash a notice (no silent F5)
- **Build toolbar** — Doctor + Apply firmware profile controls alongside Build/Upload/Clean/port/env/save profile
- **Activity switch** — short sidebar panel fade when changing Explorer / Search / SCM / Boards / Libraries / Debug / AI / Extensions

## 0.2.15 — 2026-10-11

- **Offline cache package** — separate `Aether_OfflineCache_*_windows-x64.zip` builder (`npm run build:offline-cache` / `scripts/build-offline-cache.ps1`); Settings → Tools → **Import offline cache…** merges into `~/.platformio`; docs in `docs/OFFLINE_INSTALLER.md` (toolchains still not in the main NSIS)
- **Update channels** — Settings → About → Updates: **Stable** / **Beta** (persisted); Stable → `latest.json`, Beta → `latest-beta.json`; quiet check and update dialog respect the channel

## 0.2.14 — 2026-10-11

- **ESP32-CAM Camera** — bottom-panel Camera view: HTTP JPEG/MJPEG snapshot (`/capture` or `/stream`), editable URL, Connect/Refresh, Serial IP autofill; bundled esp32-cam example serves Wi‑Fi + `/capture` (not RTSP studio)
- **MAVLink Telemetry** — Plotter Text / MAVLink mode; minimal pure-TS parser for HEARTBEAT + ATTITUDE (+ SYS_STATUS voltage); vehicle type/armed from heartbeat; raw `serial-bytes` bridge; unit tests
- **Firmware profiles** — named presets (env, upload port, project/sketch hint, monitor baud); Save / Apply / Delete in Settings + Build toolbar + Command Palette; persisted per machine

## 0.2.13 — 2026-10-11

- **E2E / smoke suite** — Vitest integration coverage for focus policy, upload/serial gate, support report, PIO Access denied hints, VS Code error mapping; `npm run test:e2e` / `npm run smoke:ui`; docs moved to `docs/E2E_SMOKE.md`
- **Upload Access denied retry** — disconnect Serial before upload; on port busy / access denied / failed to open, wait, disconnect again, retry once; clearer RU/EN hints (Arduino IDE, other Serial Monitors, cable/driver banner)
- **Save Support Report** — Help / About / Command Palette: Save report… to a chosen path (default `Documents/Aether/logs/…`); auto-write `last-error.txt` on build/upload failure

## 0.2.12 — 2026-10-11

- **Quick start (60s)** — guided onboarding: board → COM port → Blink starter → Build+Upload; Welcome CTA + Help / Command Palette («Быстрый старт»); dismiss/complete persisted
- **COM drivers help** — banner when ports are empty or open/upload hits access-denied / device-not-found; CH340, CP210x, Windows Optional Features links (no silent unsigned driver install); Serial, Upload/Output, Build toolbar
- **Libraries tabs** — PlatformIO | Arduino | GitHub; Arduino tab uses framework=arduino registry search + popular Arduino libs
- **Light theme** — Settings → Appearance Light/Dark (default remains dark); applied via `data-theme` on `<html>`
- **Arduino simplified UI** — Settings toggle: advanced activity icons behind More, Sketch mode preferred, Serial + Output emphasized
- Updater Windows install mode set to **quiet** (silent)

## 0.2.11 — 2026-10-11

- **Open in VS Code (Windows)** — stop using `CREATE_NO_WINDOW` for `Code.exe`; launch via `cmd /C start "" Code.exe folder` so the GUI appears
- **VS Code UX** — if no folder is open, prompt the folder dialog; hard failures use a longer status notice plus `window.alert` (Welcome / File menu / Command Palette)
- **Generate VS Code config** — new Rust command `vscode_generate_config` writes/merges `.vscode/extensions.json`, `settings.json`, `c_cpp_properties.json` (success lists created files)
- **Status bar** — «Serial: отключено» / «Serial: disconnected» with tooltip clarifying Serial Monitor (not app crash)

## 0.2.10 — 2026-10-11

- **VS Code launch fix (Windows)** — prefer `Code.exe` over `code.cmd`; avoid `CREATE_NO_WINDOW` on batch launchers; broader discovery (registry Uninstall keys, Insiders, LocalAppData)
- **VS Code detect** — `vscode_detect` + Settings → Tools status (path or install hint with winget / download link); clearer RU/EN missing messages
- **Audit** — tsc / vitest / cargo check; PlatformIO, Examples, Doctor, Upload, GitHub lib install paths still wired

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
