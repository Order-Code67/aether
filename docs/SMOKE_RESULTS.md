# Smoke results — Aether 0.1.0 (installed)

**Date:** 2026-10-10  
**Build:** `release/Aether_0.1.0_x64-setup.exe` → `%LOCALAPPDATA%\Aether\aether.exe`  
**Fixture:** `examples/esp32-blink`

## Automated / preflight

| Check | Result |
|-------|--------|
| Silent install (`/S`) | PASS (exit 0) |
| App launches (`aether.exe`) | PASS (process started) |
| PlatformIO on PATH | PASS (`6.2.0`) |
| clangd on PATH | PASS (`23.1.3`) |
| `pio run` on fixture | PASS |
| `compile_commands.json` present | PASS |
| Git repo in fixture | PASS (initialized for SCM) |
| COM ports / board | **BLOCKED** — none detected |

## UI checklist (manual in running app)

Open **File → Open Folder…** → `D:\Aether\examples\esp32-blink`, then:

### Workspace & files
- [ ] Welcome → Open Folder opens the PIO project
- [ ] New File / Folder / Rename / Delete
- [ ] Multi-root add / pin / remove
- [ ] Save dirty tabs

### Command Palette
- [ ] `Ctrl+Shift+P` → **PlatformIO: Build**
- [ ] `Ctrl+P` Quick Open → `main.cpp`
- [ ] App menu View / File commands

### PlatformIO & Problems
- [ ] Toolbar Build / Clean / IntelliSense DB
- [ ] (optional) break a line → failed build → Problems + markers
- [ ] Click problem → reveal line  
- [ ] Upload — needs board

### Serial & Terminal
- [ ] Serial: list ports — expect empty without board
- [ ] Terminal: PowerShell cwd = project folder

### Search & Git
- [ ] `Ctrl+Shift+F` finds `Aether esp32-blink`
- [ ] Source Control shows status / commit works
- [ ] Merge conflict UI — skip unless you create a conflict

### IntelliSense
- [ ] Status Bar clangd (after compiledb)
- [ ] Completion / hover on `main.cpp`

### Debugger
- [ ] Skip without `debug_tool` + probe

### Extensions
- [ ] Toggle built-in pack
- [ ] Marketplace Install (fallback OK)
- [ ] Publish → Hub → appears in Marketplace

### Settings & About
- [ ] About shows **0.1.0**
- [ ] Check for Updates → feed unavailable until GitHub Release hosts `latest.json`

### AI Agent
- [ ] Skip until API endpoint + key configured

## Summary

Installer + toolchain + fixture build are green. Remaining value is the UI pass above in the already-launched app; hardware/AI/updater need board, keys, and a published feed.
