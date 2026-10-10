# Changelog

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
