# Aether

Modern IDE for programming robots, drones, and embedded systems (Arduino, ESP32, ESP8266, and more).

**Stack:** Tauri 2 · React 19 · TypeScript · Vite · Tailwind CSS · Zustand · Monaco · serialport

## What’s working (Windows desktop)

- IDE chrome (Activity Bar, Sidebar, Editor, Bottom Panel, Status Bar)
- Monaco editor + tabs + dirty indicator
- Open Folder / file tree / Save (`Ctrl+S`)
- Resizable Sidebar & Bottom Panel (persisted)
- **Serial Monitor** — list COM ports, connect, read lines, send data
- **Integrated Terminal** — PowerShell via ConPTY + xterm.js (cwd = open folder)
- **PlatformIO** — detect CLI, parse `platformio.ini` envs, Build / Upload / Clean with streamed Output
- **Problems** — parse GCC/MSVC diagnostics from build output, Status Bar counts, Monaco markers, click-to-open
- **AI Agent** — streaming chat, Preview/Apply for full files, SEARCH/REPLACE patches, and unified diffs
- **File watcher** — recursive watch of all workspace roots; refreshes explorer and clean tabs
- **Multi-root workspaces** — add/remove roots, pin active root for PlatformIO / Terminal / Agent
- **Search** — text search across all roots (`Ctrl+Shift+F`), filters, click-to-open
- **Source Control** — Git status, stage/commit/diff, branches, fetch/pull/push, merge conflict editor
- **Find / Replace** — in-file `Ctrl+F` / `Ctrl+H` (Monaco)
- **Settings** — editor + AI Agent prefs (`Ctrl+,` or gear)
- **IntelliSense** — clangd LSP (completion, hover, go-to-definition, diagnostics) for C/C++ / `.ino`
- **File ops / New Project** — New File/Folder, Rename, Delete in Explorer; New PlatformIO Project wizard
- **Debugger** — PlatformIO/`pio debug` GDB MI: breakpoints, continue/step, call stack, locals, Debug Console
- **Extensions** — built-in packs, local folders, Marketplace catalog + install-from-URL
- **Extension publishing hub** — Publish tab: author packages, local hub catalog, export package/`catalog.json`
- **Русский / English** — Settings → General → Language
- **Sketch encryption** — AES-GCM password lock for source files (toolbar above editor)
- **Libraries** — PlatformIO registry search/install (Arduino-like library manager)
- **Command Palette / Quick Open** — `Ctrl+Shift+P` / `Ctrl+P`, native app menu wired to the same commands
- **About** — live app version in Settings → About
- **Auto-updater** — signed Tauri updates; Stable / Beta channel in Settings → About → Updates
- **Offline PlatformIO cache** — Prepare online or Import a portable zip (ESP32 + AVR); see [`docs/OFFLINE_INSTALLER.md`](docs/OFFLINE_INSTALLER.md)
- **FC Configurator** — Activity **FC Config**: iNav drones & planes with Betaflight-style PID/rates/RX, ArduPilot-style parameter browser & presets, Ports/Modes, CLI/diff, DFU flash (see [`docs/INAV_MSP.md`](docs/INAV_MSP.md))

## Not yet

- Signed remote extension store / cloud publisher accounts

## Prerequisites (Windows)

1. Node.js 20+
2. Rust (rustup)
3. VS 2022 Build Tools (C++)
4. WebView2

## Develop

```bash
npm install
npm run tauri:dev
```

Browser-only preview (`npm run dev`) has no real filesystem/serial.

## Settings & Find

- `Ctrl+,` or Activity Bar gear → Editor / AI Agent / About
- In open file: `Ctrl+F` find, `Ctrl+H` replace (Monaco widget)

## Search

1. Activity Bar → **Search**, or `Ctrl+Shift+F`
2. Type a query (debounced); optional Match Case and `cpp,h,ini` include filter
3. Click a result to open the file at that line

## Source Control

1. Install Git (`git` on PATH)
2. Open / pin a folder that is a Git repo (or `git init` in Terminal)
3. Activity → **Source Control**, or `Ctrl+Shift+G`
4. Stage (`+`), unstage (`−`), discard, view diff, write a message → **Commit**
5. Click the branch name to switch / create branches; toolbar: Fetch · Pull · Push
6. Status Bar shows branch and change count (`!` = merge conflicts)
7. On conflict: SCM → **Merge Conflicts** → Resolve, or open the file — Accept Current / Incoming / Both

## File operations & New Project

1. Welcome / Explorer → **New PlatformIO Project…** — pick parent folder, name, board → `pio project init`
2. With a folder open: Explorer toolbar **New File** / **New Folder**, or right-click a folder/file
3. Right-click → **Rename…** / **Delete…** (workspace roots cannot be deleted from disk here — remove them from the workspace instead)

## Multi-root workspace

1. **Open Folder…** for the first root
2. Explorer → **Add Folder** (folders icon) to attach more projects
3. Click a root name (pin) to set it **active** — PlatformIO Build/Upload, Terminal cwd, and relative Agent paths use the active root
4. Hover a root → remove it from the workspace without closing others

## Release build

```bash
# Sign updater artifacts (required for auto-update)
# PowerShell: $env:TAURI_SIGNING_PRIVATE_KEY = (Get-Content -Raw src-tauri\keys\aether.key)
npm run tauri:build
```

Installers land under `src-tauri/target/release/bundle/` (copy to `release/` for a local package).

Ready package for **0.1.0**: `release/Aether_0.1.0_x64-setup.exe`, `release/latest.json`, see [`CHANGELOG.md`](CHANGELOG.md).

Publishing updates: [`docs/UPDATES.md`](docs/UPDATES.md) — regenerate `latest.json` + `latest-beta.json` with `.\scripts\make-latest-json.ps1`.

Offline toolchain pack (separate from the installer): `npm run build:offline-cache` → see [`docs/OFFLINE_INSTALLER.md`](docs/OFFLINE_INSTALLER.md).

## Serial Monitor

1. Connect a board (USB-UART / native USB CDC)
2. Bottom Panel → **Serial**
3. Pick `COMx`, baud (default `115200`) → **Connect**
4. Incoming lines stream in the log; type + Enter / Send to transmit

## PlatformIO

1. Install [PlatformIO Core](https://docs.platformio.org/en/latest/core/installation.html) (`pio` on PATH or `~/.platformio/penv`)
2. **Open Folder** containing `platformio.ini`
3. Use the PlatformIO toolbar (Build / Upload / Clean / IntelliSense DB) or Activity → **Boards**
4. Shortcuts: `Ctrl+Shift+B` build, `Ctrl+Alt+U` upload
5. Output streams in Bottom Panel → **Output**
6. **IntelliSense DB** runs `pio run -t compiledb` so clangd can use `compile_commands.json`

## Command Palette

1. `Ctrl+Shift+P` — run any IDE command (Build, Debug, View panels, Git, …)
2. `Ctrl+P` — Quick Open file by name (indexes open workspace trees)
3. Native menu (File / Edit / View / Run / Help) invokes the same command ids

## Extensions

1. Activity Bar → **Extensions** (`Ctrl+Shift+X`)
2. **Installed** — toggle built-in packs; **Load…** for a local folder with `extension.json`
3. **Marketplace** — local hub + bundled catalog (+ optional remote catalog URL); **Install** / URL install
4. **Publish** — author snippets/boards → **Publish to Hub**, export package or `catalog.json` ([`docs/PUBLISHING.md`](docs/PUBLISHING.md))
5. Enabled snippet packs appear in Monaco completions; board packs extend **New Project**
6. Smoke tests: [`docs/SMOKE.md`](docs/SMOKE.md)

### Local extension format

```json
{
  "id": "publisher.name",
  "name": "Display Name",
  "version": "0.1.0",
  "description": "…",
  "publisher": "You",
  "category": "snippets",
  "contributes": {
    "languages": ["cpp"],
    "snippets": [{ "label": "foo", "insertText": "bar($1);", "detail": "…" }],
    "boards": [{ "id": "esp32dev", "label": "ESP32" }]
  }
}
```

## Debugger

1. Open a PlatformIO project with `debug_tool` configured in `platformio.ini` (and a connected probe / suitable target)
2. Activity Bar → **Run and Debug** (`Ctrl+Shift+D`), pick env → **Start** (or `F5`)
3. Click the editor **gutter** to toggle breakpoints
4. When stopped: Continue `F5`, Step Over `F10`, Step Into `F11`, Step Out `Shift+F11`, Stop `Shift+F5`
5. Bottom Panel → **Debug Console** for GDB/MI output and commands

## IntelliSense (clangd)

1. Install [LLVM/clangd](https://clangd.llvm.org/installation) and ensure `clangd` is on PATH
2. Open a folder (PlatformIO project recommended)
3. For PIO projects: toolbar → **IntelliSense DB** (or Build once) so `compile_commands.json` exists under `.pio/build/<env>/`
4. Open a `.cpp` / `.h` / `.ino` file — completion, hover, and Go to Definition use clangd
5. Status Bar shows `clangd` (or `clangd · no DB` if compile commands are missing)

## AI Agent

1. Activity Bar → **Agent** (or gear → Agent settings)
2. Set Base URL (OpenAI-compatible), API key, and model
3. Optionally attach active editor file and Problems
4. Ask about firmware, builds, pins, serial debugging (Enter to send; Stop cancels stream)
5. Edits: full-file fence, or `SEARCH/REPLACE` / `diff` patch → **Preview** (eye) then **Apply**

## FC Configurator (iNav)

1. Activity Bar → **FC Config** (or Welcome Hub → FC Configurator)
2. Pick COM port → **Connect** (owns the serial port; Serial Monitor disconnects first)
3. Use tabs: Setup · PID · Rates · Receiver · Battery · Failsafe · GPS/Nav · Mixer · Ports · Modes · Parameters · Presets · CLI · Diff · Flash
4. Writes go to FC RAM with confirm + auto-backup under `Documents/Aether/drones/diffs/` — Save EEPROM / CLI `save` separately
5. Never arms motors from Aether; see [`docs/INAV_MSP.md`](docs/INAV_MSP.md)
