# Changelog

## 0.2.40 — 2026-10-18

- **AI Agent network** — connect timeout 5s→30s; clearer error when OpenRouter/API is unreachable (VPN/proxy/firewall)

## 0.2.39 — 2026-10-17

- **Arduino CLI** вЂ” first-class build tool: PATH + common Windows install detect, compile/upload/clean, FQBN mapping from `platformio.ini`, lib search/install into project `lib/`, core ensure (avr/esp32), Tools Doctor + Settings status
- **Unified Doctor** вЂ” single Activity panel for PlatformIO / arduino-cli / COM / drivers / offline cache / Configurator with fix/recheck actions
- **Hints & checklists** вЂ” scenario step checklists (Blink / LoRa / COM) on Welcome and Load Sources; coach steps polish
- **LoRa / Р‘РџР›Рђ polish** вЂ” TX+RX pair flow, radio Doctor, LoRaPathGuide, BPLA quick path vs Configurator handoff, AI board context
- **Onboarding** вЂ” Blink в†’ LoRa в†’ Configurator tour; Arduino-first + radio/Р‘РџР›Рђ positioning (Welcome / hub tagline)
- **Market stubs** вЂ” optional telemetry opt-in (`docs/TELEMETRY.md`), signing/release docs, Extensions marketplace placeholder polish
- **Dist** вЂ” `package-dist` / clean-Windows docs aligned with OfflineLibs USB pack

## 0.2.38 вЂ” 2026-10-14

- **Visible hints** вЂ” status-bar lightbulb В«РџРѕРґСЃРєР°Р·РєРёВ» (default ON), Welcome coach steps, PanelHint strips, Settings в†’ General toggle; shared Tooltip helper (RU/EN)

## 0.2.37 вЂ” 2026-10-14

- **Tooltips max** вЂ” discoverability titles across Settings, Welcome, Build/Upload, LoRa path, Agent, SCM, Libraries, Extensions, BPLA/Configurator, Serial, Status, and Command Palette (RU/EN)

## 0.2.36 вЂ” 2026-10-14

- **UI chrome** вЂ” native menu bar hidden (accelerators via shortcuts + Command Palette); tooltips on layout chrome, serial, and status controls
- **Where to Load** вЂ” new Activity / sidebar tab (`Load Sources`) for offline cache, examples, and folder guidance
- **Configurator detect** вЂ” finds portable `Aether Configurator*.exe`, `D:\CFG\Aether`, and side-by-side install paths; clearer launch errors

## 0.2.35 вЂ” 2026-10-12

- **Arduino-first** вЂ” Quick Start Blink/Servo by board; LoRa TX+RX pair (TX active + RX second folder); LoRa guide + Doctor/Plotter glue
- **Р‘РџР›Рђ в†’ Aether Configurator** вЂ” Activity Р‘РџР›Рђ launches Configurator with COM handoff (`AETHER_CONFIGURATOR`); Р‘РџР›Рђ-РЎС‚СѓРґРёСЏ removed from IDE bridge
- **LoRa wow path** вЂ” guide strip; auto-open Plotter on RSSI/SNR; Doctor on serial/build/upload fail; radio tips on env change; TTGO V1 OLED 4/15
- **BPLA in-IDE** вЂ” COM в†’ MSP в†’ CLI в†’ DFU в†’ live MSPв†’Plotter (quick path; full FC в†’ Configurator)

## 0.2.34 вЂ” 2026-10-12

- **Distribution** вЂ” Public Desktop shortcut on All Users install; auto-detect `Aether_OfflineCache_*` / `OfflineLibs_*` next to app / Desktop / Downloads with one-click import; `npm run build:offline-libs` + `package:dist` USB pack; Welcome clean-PC (~15 min) path + `docs/CLEAN_WINDOWS.md`
- **Reliability** вЂ” `pio pkg install/uninstall` 90вЂ“120s timeouts (no offline hang); clearer offline-cache zip errors
- **AI board context** вЂ” loads `platformio.ini` from disk (not only open tab); system prompt prefers ini SEARCH/REPLACE for board/lib_deps/LoRa flags
- **Board strip** вЂ” env / region / NSSВ·DIOВ·RST under build toolbar
- **Plotter radio** вЂ” RSSI/SNR channels sorted first + Radio badge
- **Р‘РџР›Рђ-РЎС‚СѓРґРёСЏ** вЂ” MSP RSSI on Status card
- **CI** вЂ” GitHub Actions: unit + contracts + tsc + Playwright smoke

## 0.2.33 вЂ” 2026-10-12

- **LoRaWAN OTAA** вЂ” Join + periodic uplink (RadioLib), not a stub; Serial step guide; wizard starter updated
- **Offline cache libs** вЂ” `build-offline-cache` / Prepare cache also installs RadioLib, ArduinoJson, OLED, Servo, вЂ¦ into `lib/`; import merges `lib/`
- **Updater key** вЂ” signing keypair rotated (backup `Documents/Aether/keys/aether.key`); pubkey in `tauri.conf.json`

## 0.2.32 вЂ” 2026-10-12

- **LoRa stacks** вЂ” Libraries panel one-click stacks: LoRa (RadioLib + OLED + ArduinoJson), Meshtastic helpers, ESP-NOW helpers
- **Bundled LoRa examples** вЂ” TX/RX with pin maps (Heltec V2/V3, TTGO, T-Beam, ESP32), Mega+RFM95, LoRaWAN/TTN stub, ESP-NOW stub, Meshtastic stub
- **Project wizard** вЂ” Heltec V3 / T-Beam boards; starters LoRa TX/RX, LoRaWAN, ESP-NOW; region presets EU868 / US915 / RU864
- **Hardware presets** вЂ” Settings в†’ Firmware profiles: open Heltec / T-Beam / Mega+SX1276 examples with env
- **Radio Doctor** вЂ” SPI/OLED/region tips when the open project looks like LoRa
- **AI board context** вЂ” optional attach of selected env, pin map, lib_deps / build_flags
- **Offline cache** вЂ” docs/script note: espressif32 + atmelavr cover ESP32/Mega/LoRa boards (`npm run build:offline-cache`)

## 0.2.31 вЂ” 2026-10-11

- **AI Agent silence fix** вЂ” no longer hard-blocks send on a failed gstatic connectivity probe (WebView2 / blocked regions); hard-block only when `navigator.onLine === false`; multi-endpoint probe for soft offline UI
- **Streaming robustness** вЂ” SSE delta parser accepts string or content-part arrays; empty stream retries once via non-streaming `ai_chat_completion`
- **Errors visible** вЂ” sticky Agent error banner with dismiss; RU/EN for offline / API key / empty / request failed / desktop-only; `busy` always cleared; agent last error in support report

## 0.2.30 вЂ” 2026-10-11

- **Finish incomplete WIP** вЂ” orphaned full iNav configurator UI removed from the IDE (Activity **Р‘РџР›Рђ** remains the Р‘РџР›Рђ-РЎС‚СѓРґРёСЏ bridge only); experimental Electron `apps/aether-configurator/` committed with honest docs (not an IDE launch target yet; primary FC path stays Р‘РџР›Рђ-РЎС‚СѓРґРёСЏ); driver binary cache gitignored; incomplete Navigation upload / Blackbox charts labeled RU/EN В«СЃРєРѕСЂРѕВ» / Coming soon; no silent no-op driver install when cache is empty

## 0.2.29 вЂ” 2026-10-11

- **AI voice (Whisper fallback)** вЂ” Web Speech remains an optional fast path when `webkitSpeechRecognition` exists; otherwise MediaRecorder mic capture posts to OpenAI-compatible `/v1/audio/transcriptions` using Agent Settings base URL + API key; transcript appends to the composer; offline / no-key / mic-denied / unsupported / timeout errors in RU/EN; recording pulse and no stuck listening state

## 0.2.28 вЂ” 2026-10-11

- **External iNav Configurator opt-in** вЂ” button / checklist step / command palette `inav.openConfigurator` hidden by default; enable via Settings в†’ Tools в†’ В«Show external iNav Configurator buttonВ» (persisted `showExternalInavConfigurator`); RU/EN

## 0.2.27 вЂ” 2026-10-11

- **AI attachments** вЂ” paperclip multi-select + drag-drop onto the composer; text/code files packed into the next user message (в‰€150KB total budget, truncated); chips with remove; cleared after send; images skipped with a clear RU/EN notice (backend is string-only, no vision)
- **AI voice input** вЂ” mic button uses Web Speech API when available (`webkitSpeechRecognition` / `SpeechRecognition`); interim+final transcript appends to the draft; language follows app locale (`ru-RU` / `en-US`); recording pulse; friendly errors if unsupported or mic denied

## 0.2.26 вЂ” 2026-10-11

- **Offline mode** вЂ” detect offline (`navigator.onLine` + short probe); status-bar В«РћС„Р»Р°Р№РЅВ» / Offline; suppress auto update check, registry search on panel open, and remote marketplace fetch when offline
- **Timeouts** вЂ” updater / HTTP fetches race at ~4.5s; PlatformIO / arduino-cli registry search kill after 12s; AI connect timeout 5s; friendly RU/EN errors instead of long freezes
- **Libraries** вЂ” Search button required for registry queries (chip/tab switches no longer auto-hit the network)
- **Р‘РџР›Рђ-РЎС‚СѓРґРёСЏ** вЂ” standalone Tauri FC configurator in `apps/bpla-studio` (iNav/Betaflight/ArduPilot boards, own installer via `npm run studio:build`); Aether keeps only a thin bridge (detect/launch + COM `--port/--baud` handoff); full FC workspace removed from the IDE; docs in `docs/BPLA_STUDIO.md`

## 0.2.25 вЂ” 2026-10-11

- **Install to any drive/folder** вЂ” NSIS `installMode: both` (per-user or all-users) plus directory page; pick e.g. `D:\Apps\Aether` or `E:\Aether`, not only Program Files; all-users still creates Public Desktop shortcut; custom `windows/installer.nsi` keeps `/D=` across MultiUser init
- **Silent custom path** вЂ” `Aether_0.2.25_x64-setup.exe /S /D=D:\Aether` (`/D=` must be last); see `docs/UPDATES.md`

## 0.2.24 вЂ” 2026-10-11

- **Welcome Hub** вЂ” five large modules (Arduino Quick Start, PlatformIO/boards, iNav, VS Code, AI) with subtle hub watermark; secondary links kept; RU/EN
- **iNav Ports + Modes** вЂ” UART roles via MSP_CF_SERIAL_CONFIG best-effort + CLI `serial` fallback (iNav deprecates 54/55 вЂ” see `docs/INAV_MSP.md`); Modes via MSP_MODE_RANGES / BOXNAMES / BOXIDS; confirm + auto diff backup under `Documents/Aether/drones/diffs` before write; explicit EEPROM save; unit tests; never arm/motors
- **iNav onboarding checklist** вЂ” Port в†’ Connect в†’ Status в†’ Diff в†’ Configurator (optional); persisted, dismissible; RU/EN
- **FC .hex Flash** вЂ” pick hex, detect DFU (`dfu-util -l`), flash via dfu-util on PATH with Output log; disconnect serial first; confirm dialog; clear RU/EN install / not-in-DFU hints

## 0.2.23 вЂ” 2026-10-11

- **Hub branding icon** вЂ” desktop/app icon replaced with the hub concept art; regenerated `src-tauri/icons/*` (incl. `icon.ico`) and About UI `public/aether-icon.png`
- **Desktop shortcut for all users** вЂ” NSIS `installMode: perMachine` installs to Program Files and creates the Public Desktop shortcut (silent/passive installs); installer uses the new product `.ico`

## 0.2.22 вЂ” 2026-10-11

- **iNav MSP Status / Setup (read-only)** вЂ” Status card in iNav activity: poll MSP_API_VERSION / FC_VARIANT / FC_VERSION / NAME / STATUS(_EX) / ANALOG / RAW_GPS over the same COM session; binary `serial_write_bytes`; sends `exit` before poll (CLI vs MSP); non-INAV warning; RU/EN; MSP v1/v2 encode/decode unit tests вЂ” no EEPROM write, motors, calibration, Ports/Modes/PID

## 0.2.21 вЂ” 2026-10-11

- **iNav activity** вЂ” Activity Bar **iNav** (Р”СЂРѕРЅС‹ / iNav): COM connect/disconnect (owns serial; releases Monitor first), FC CLI console with quick chips (`help` / `version` / `status` / `diff` / `dump`), Get/Save/Load/Send diff under `Documents/Aether/drones/diffs/`, persisted iNav profiles, Open iNav Configurator (detect common Windows paths + PATH; disconnect first; download hint), Plotter shortcut; View menu + Command Palette; RU/EN; unit tests for diff/path helpers вЂ” not MSP PID / DFU / Betaflight

## 0.2.20 вЂ” 2026-10-11

- **MAVLink Telemetry HUD** вЂ” Plotter MAVLink mode expands beyond HEARTBEAT/ATTITUDE: GPS_RAW_INT / GLOBAL_POSITION_INT (lat/lon/alt/fix/sats), SYS_STATUS + BATTERY_STATUS (%, V, A), VFR_HUD (speed/heading/throttle/alt); HUD strip above plots; channels for alt, speed, battery, roll/pitch/yaw; unit tests; RU/EN вЂ” still not a GCS / map / missions
- **ESP32-CAM** вЂ” bundled example: proper AI-Thinker init, `/capture` JPEG + `/stream` MJPEG, Serial Capture/Stream URLs, 5 V / brownout notes in README + sketch; Camera panel RU/EN power hint when env/URL looks like ESP32-CAM

## 0.2.19 вЂ” 2026-10-11

- **Playwright E2E** вЂ” `@playwright/test` smoke against Vite preview (Welcome, Settings, Command Palette); `npm run test:e2e`; Vitest contracts moved to `npm run test:contracts`; expanded `docs/E2E_SMOKE.md` checklist (Monaco, Search, Terminal, VS Code, Upload/Serial, Quick Start, Libraries, Camera/Plotter)

## 0.2.18 вЂ” 2026-10-11

- **Firmware profiles export/import** вЂ” Settings + Command Palette: export selected/all profiles to JSON (`Documents/Aether/profiles`); import with replace or merge; schema validation; RU/EN errors; localStorage unchanged
- **Serial Plotter** вЂ” clearer Pause badge; horizontal zoom (+/в€’ / Ctrl+wheel) and pan; reset zoom; export visible or all samples as CSV
- **Camera** вЂ” save current frame (PNG/JPEG); record N-frame series to a folder; auto-reconnect with backoff + вЂњReconnectingвЂ¦вЂќ; optional keep last good frame on WiвЂ‘Fi drop
- **Debug watches & conditions** вЂ” Watch panel evaluates expressions when paused via GDB; per-breakpoint condition (Debug panel / context menu); continue when condition is false (best-effort)

## 0.2.17 вЂ” 2026-10-11

- **Quick Start on first launch** вЂ” desktop app opens the Quick Start wizard once when `onboardingDone` is unset; skip/complete still persisted (0.2.12+); Welcome / Help / Palette unchanged
- **Real Beta channel** вЂ” Stable feed (`latest.json`) stays on non-prerelease; Beta (`latest-beta.json`) points at a genuine prerelease (e.g. `v0.2.17-beta.1`) with its own signed installer; update dialog shows a **Beta** badge; see `docs/UPDATES.md`
- **Settings Editor / Agent RU** вЂ” all Editor and Agent tab labels/hints/options wired through i18n (en + ru)
- **Arduino libraries via arduino-cli** вЂ” Libraries в†’ Arduino detects `arduino-cli` on PATH; search/install into project `lib/` (PlatformIO-compatible); without CLI falls back to PlatformIO `framework=arduino` registry with install hint

## 0.2.16 вЂ” 2026-10-11

- **UI audit / menu wiring** вЂ” View menu covers Boards, Libraries, AI, Problems, Output, Serial, Plotter, Camera, Debug Console; every native menu id is covered by the command registry (parity test)
- **Command failures surface** вЂ” unknown menu/palette ids and thrown command errors show RU/EN status notices instead of silent no-ops
- **Debug Start** вЂ” missing project / desktop / already-running cases open the Debug panel and flash a notice (no silent F5)
- **Build toolbar** вЂ” Doctor + Apply firmware profile controls alongside Build/Upload/Clean/port/env/save profile
- **Activity switch** вЂ” short sidebar panel fade when changing Explorer / Search / SCM / Boards / Libraries / Debug / AI / Extensions

## 0.2.15 вЂ” 2026-10-11

- **Offline cache package** вЂ” separate `Aether_OfflineCache_*_windows-x64.zip` builder (`npm run build:offline-cache` / `scripts/build-offline-cache.ps1`); Settings в†’ Tools в†’ **Import offline cacheвЂ¦** merges into `~/.platformio`; docs in `docs/OFFLINE_INSTALLER.md` (toolchains still not in the main NSIS)
- **Update channels** вЂ” Settings в†’ About в†’ Updates: **Stable** / **Beta** (persisted); Stable в†’ `latest.json`, Beta в†’ `latest-beta.json`; quiet check and update dialog respect the channel

## 0.2.14 вЂ” 2026-10-11

- **ESP32-CAM Camera** вЂ” bottom-panel Camera view: HTTP JPEG/MJPEG snapshot (`/capture` or `/stream`), editable URL, Connect/Refresh, Serial IP autofill; bundled esp32-cam example serves WiвЂ‘Fi + `/capture` (not RTSP studio)
- **MAVLink Telemetry** вЂ” Plotter Text / MAVLink mode; minimal pure-TS parser for HEARTBEAT + ATTITUDE (+ SYS_STATUS voltage); vehicle type/armed from heartbeat; raw `serial-bytes` bridge; unit tests
- **Firmware profiles** вЂ” named presets (env, upload port, project/sketch hint, monitor baud); Save / Apply / Delete in Settings + Build toolbar + Command Palette; persisted per machine

## 0.2.13 вЂ” 2026-10-11

- **E2E / smoke suite** вЂ” Vitest integration coverage for focus policy, upload/serial gate, support report, PIO Access denied hints, VS Code error mapping; `npm run test:e2e` / `npm run smoke:ui`; docs moved to `docs/E2E_SMOKE.md`
- **Upload Access denied retry** вЂ” disconnect Serial before upload; on port busy / access denied / failed to open, wait, disconnect again, retry once; clearer RU/EN hints (Arduino IDE, other Serial Monitors, cable/driver banner)
- **Save Support Report** вЂ” Help / About / Command Palette: Save reportвЂ¦ to a chosen path (default `Documents/Aether/logs/вЂ¦`); auto-write `last-error.txt` on build/upload failure

## 0.2.12 вЂ” 2026-10-11

- **Quick start (60s)** вЂ” guided onboarding: board в†’ COM port в†’ Blink starter в†’ Build+Upload; Welcome CTA + Help / Command Palette (В«Р‘С‹СЃС‚СЂС‹Р№ СЃС‚Р°СЂС‚В»); dismiss/complete persisted
- **COM drivers help** вЂ” banner when ports are empty or open/upload hits access-denied / device-not-found; CH340, CP210x, Windows Optional Features links (no silent unsigned driver install); Serial, Upload/Output, Build toolbar
- **Libraries tabs** вЂ” PlatformIO | Arduino | GitHub; Arduino tab uses framework=arduino registry search + popular Arduino libs
- **Light theme** вЂ” Settings в†’ Appearance Light/Dark (default remains dark); applied via `data-theme` on `<html>`
- **Arduino simplified UI** вЂ” Settings toggle: advanced activity icons behind More, Sketch mode preferred, Serial + Output emphasized
- Updater Windows install mode set to **quiet** (silent)

## 0.2.11 вЂ” 2026-10-11

- **Open in VS Code (Windows)** вЂ” stop using `CREATE_NO_WINDOW` for `Code.exe`; launch via `cmd /C start "" Code.exe folder` so the GUI appears
- **VS Code UX** вЂ” if no folder is open, prompt the folder dialog; hard failures use a longer status notice plus `window.alert` (Welcome / File menu / Command Palette)
- **Generate VS Code config** вЂ” new Rust command `vscode_generate_config` writes/merges `.vscode/extensions.json`, `settings.json`, `c_cpp_properties.json` (success lists created files)
- **Status bar** вЂ” В«Serial: РѕС‚РєР»СЋС‡РµРЅРѕВ» / В«Serial: disconnectedВ» with tooltip clarifying Serial Monitor (not app crash)

## 0.2.10 вЂ” 2026-10-11

- **VS Code launch fix (Windows)** вЂ” prefer `Code.exe` over `code.cmd`; avoid `CREATE_NO_WINDOW` on batch launchers; broader discovery (registry Uninstall keys, Insiders, LocalAppData)
- **VS Code detect** вЂ” `vscode_detect` + Settings в†’ Tools status (path or install hint with winget / download link); clearer RU/EN missing messages
- **Audit** вЂ” tsc / vitest / cargo check; PlatformIO, Examples, Doctor, Upload, GitHub lib install paths still wired

## 0.2.9 вЂ” 2026-10-11

- **Welcome PCB backdrop** вЂ” subtle animated circuit / microchip background on the Welcome screen (paused when the tab is hidden)
- **GitHub libraries** вЂ” Libraries panel: install from `owner/repo` or `https://github.com/вЂ¦` (#branch) via PlatformIO `lib_deps` / `pio pkg install`
- **VS Code integration** вЂ” Open folder in VS Code; generate / merge `.vscode` helpers (PlatformIO extension + IntelliSense hints); File menu, Command Palette, Settings в†’ Tools, Welcome

## 0.2.8 вЂ” 2026-10-10

- **Serial Plotter** вЂ” live numeric charts from serial (`temp:23.5`, `value=12`, or CSV); pause / clear / per-channel toggles in the bottom panel
- **Hardware profiles** вЂ” Pixhawk / ArduPilot, Betaflight / ESPFC, and ESP32-CAM stubs in Examples; New Project wizard points to them
- **Debug gutter & toolbar** вЂ” editor breakpoint gutter (persisted per file), Debug toolbar / panel for `pio debug` sessions
- **Multi-env switcher** вЂ” pick the active PlatformIO env from the Build toolbar / Status Bar when `platformio.ini` has several envs

## 0.2.7 вЂ” 2026-10-10

- **Focus reliability** вЂ” Monaco / Search / Terminal focus policy; bottom panel stays mounted when collapsed; Vitest guards + `docs/FOCUS_SMOKE.md`
- **Support report** вЂ” Help / About / Command Palette: Copy Support Report to clipboard (RU/EN)
- **Quiet updates** вЂ” startup check without modal spam when up-to-date; update dialog with RU changelog notes; Settings shows last check result

## 0.2.6 вЂ” 2026-10-10

- **Sketch mode** вЂ” Arduino-like Explorer (default ON for PlatformIO): emphasize main sketch, hide `.pio` clutter, optional вЂњShow all filesвЂќ, auto-open `src/main.cpp`
- **Board / port memory** вЂ” per-project env + upload port persistence; auto-detect COM on open and before upload
- **Examples catalog** вЂ” card UI with RU/EN descriptions and board tags; ESP32 Wi-Fi stub example
- **Offline cache** вЂ” Settings в†’ Tools: detect `~/.platformio` platforms and pre-download espressif32 + atmelavr (streams to Output). To reuse toolchains across machines, copy the entire `~/.platformio` folder (see `docs/OFFLINE_CACHE.md`). Toolchains are **not** embedded in the NSIS installer.

## 0.2.5 вЂ” 2026-10-10

- **Install missing tools** вЂ” Tools Doctor can install missing PlatformIO / toolchain pieces from the banner
- **Upload progress & errors** вЂ” clearer upload progress plus friendly COM port / driver error decoding
- **Libraries** вЂ” install progress, favorites / recent, and an ESP32Servo hint when the Servo library is a poor fit

## 0.2.4 вЂ” 2026-10-10

- **New Project wizard** вЂ” guided project creation (board / framework) from Explorer and File menu
- **Tools Doctor** вЂ” startup check for PlatformIO / toolchain readiness with a clear banner when something is missing
- **Upload / COM port** вЂ” clearer port selection and Upload UX when flashing firmware

## 0.2.3 вЂ” 2026-10-10

- **Bundled examples** вЂ” ESP32 Blink, Arduino Mega Servo, and Arduino Nano ship with the install (File в†’ Open ExampleвЂ¦ / welcome **РџСЂРёРјРµСЂС‹**); copies into `Documents/Aether/examples`
- **Library presets** вЂ” example `platformio.ini` files include common `lib_deps` (ArduinoJson, Servo / ESP32Servo, FastLED)
- Includes prior library-manager and icon fixes from 0.2.x

## 0.2.2 вЂ” 2026-10-10

- **App icon** вЂ” corrected branding: robot hand holding planet (not robot book); regenerated `src-tauri/icons/*` and About UI `public/aether-icon.png`

## 0.2.1 вЂ” 2026-10-10

- **App icon** вЂ” new robot-book / planet branding (Tauri `src-tauri/icons/*`)
- **Typing / focus** вЂ” editor and input focus fixes carried forward
- **Libraries** вЂ” Arduino-framework install/search fix; broader вЂњArduinoвЂќ chip (framework=arduino, not AVR-only)
- **Libraries UI** вЂ” clearer RU helper steps, Activity Bar tooltip (РєРЅРёРіР°/Р±РёР±Р»РёРѕС‚РµРєРё), real error messages via `errorMessage`

## 0.2.0 вЂ” 2026-10-10

- **i18n** вЂ” Russian / English (Settings в†’ General)
- **Sketch encryption** вЂ” AES-GCM password lock for source files
- **Libraries** вЂ” PlatformIO registry search & install (Arduino-like manager)
- Input/focus fixes for Monaco + hidden terminal stdin

## 0.1.0 вЂ” 2026-10-10

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
