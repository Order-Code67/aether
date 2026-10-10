# Focus smoke checklist (manual)

Unit tests cover CSS/user-select contracts and terminal stdin helpers (`npm test`). Full WebView2 focus races still need a short manual pass in `npm run tauri:dev`.

## Setup

1. Open a folder with a `.cpp` / PlatformIO project so Monaco has a tab.
2. Ensure the bottom panel can show **Terminal**.

## Cases

1. **Editor typing**
   - Click into Monaco, type characters.
   - Expected: keys go to the editor (not the terminal).

2. **Search does not lose keys to terminal**
   - Open **Search** (`Ctrl+Shift+F`), type a query.
   - Expected: characters appear in the Search input.

3. **Switch Search ↔ Editor**
   - With Search focused, click an editor tab / editor surface and type.
   - Open Search again and type.
   - Expected: focus follows the surface you clicked; no “dead” typing.

4. **Terminal inactive while hidden**
   - Open **Terminal**, type a command character, then switch to **Output** (or collapse the bottom panel).
   - Click Monaco and type.
   - Expected: keys go to Monaco; terminal session may stay alive but must not capture stdin while hidden.

5. **Terminal active again**
   - Show **Terminal** and click into it; type.
   - Expected: keys go to the shell again.

6. **Dialogs**
   - Open Settings, type in a field (e.g. font size / agent URL).
   - Expected: Monaco/terminal do not steal keystrokes.

## Notes

- Collapse uses `hidden` (not unmount) for visited terminal/serial panels so PTY can survive while `disableStdin` is on.
- If typing fails only after a specific sequence, note the sequence for a regression test.
