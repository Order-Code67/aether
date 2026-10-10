# Aether smoke checklist

Run after `npm run tauri:dev` or a release build. Check each item on Windows.

## Workspace & files

- [ ] Welcome → **Open Folder…** opens a PlatformIO project
- [ ] Welcome / Explorer → **New PlatformIO Project…** creates and opens a project
- [ ] Explorer: New File / New Folder / Rename / Delete
- [ ] Multi-root: Add Folder, pin active root, remove root
- [ ] `Ctrl+S` / `Ctrl+Shift+S` save dirty tabs

## Command Palette

- [ ] `Ctrl+Shift+P` opens Command Palette; run **PlatformIO: Build**
- [ ] `Ctrl+P` Quick Open finds and opens a file
- [ ] App menu **View → Command Palette** / **File → Save** work

## PlatformIO & Problems

- [ ] Build / Upload / Clean / IntelliSense DB from toolbar
- [ ] Output streams; failed build shows Problems + Monaco markers
- [ ] Click a problem to reveal line

## Serial & Terminal

- [ ] Serial: list COM ports, connect, send a line
- [ ] Terminal: PowerShell opens with cwd = active folder

## Search & Git

- [ ] `Ctrl+Shift+F` search across roots
- [ ] Source Control: status, stage, commit, branch, fetch/pull/push
- [ ] Merge conflict banner + Accept Current/Incoming/Both

## IntelliSense (clangd)

- [ ] Status Bar shows clangd (or “no DB”)
- [ ] Completion / hover / go-to-definition on a `.cpp` / `.ino` file

## Debugger

- [ ] Run and Debug → Start (`F5`) with `debug_tool` configured
- [ ] Gutter breakpoint; Continue / Step / Stop
- [ ] Debug Console shows MI/GDB output

## Extensions & Marketplace

- [ ] `Ctrl+Shift+X` Extensions → toggle a built-in pack
- [ ] Marketplace tab → Install (uses fallback if remote URL 404s)
- [ ] Install from URL field with a raw `extension.json`
- [ ] Snippet appears in Monaco after enable
- [ ] Publish tab → add snippet → **Publish to Hub** → entry shows in Marketplace
- [ ] Export Package / Export Hub Catalog write files on disk

## Settings & About

- [ ] `Ctrl+,` Settings; About shows live app version
- [ ] Editor prefs persist after restart
- [ ] About → **Check for Updates** (uptodate or “feed not available” until `latest.json` is published)
- [ ] Help menu → **Check for Updates…**

## AI Agent

- [ ] Agent chat streams with configured OpenAI-compatible endpoint
- [ ] Preview / Apply edit lands in editor
