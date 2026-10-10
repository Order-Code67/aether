# E2E / UI smoke checklist

Automated coverage (`npm test`, `npm run test:e2e`) guards focus contracts, upload/serial gate policy, support-report formatting, VS Code error mapping, and PIO error hints. Full WebView2 focus races still need a short manual pass in `npm run tauri:dev`.

See also `docs/SMOKE.md` for the broader product checklist.

## Automated

```bash
npm test                 # Vitest unit + integration (CI-friendly)
npm run test:e2e         # Focused stability suite (same runner, curated files)
npm run smoke:ui         # Prints this checklist + runs test:e2e
```

Covered automatically:

| Area | Where |
|------|--------|
| Monaco / Search / Terminal focus + CSS user-select | `src/lib/focusPolicy.test.ts` |
| Upload blocked / serial disconnect gate + retry policy | `src/lib/uploadGate.test.ts` |
| Support report contents (EN/RU) | `src/lib/supportReport.test.ts` |
| PIO Access denied / open-port friendly messages | `src/lib/pioErrors.test.ts` |
| Open in VS Code invoke error paths | `src/lib/vscodeIntegration.test.ts` |

## Manual (WebView2 / `tauri:dev`)

### Setup

1. `npm run tauri:dev`
2. Open a folder with a `.cpp` / PlatformIO project so Monaco has a tab.
3. Ensure the bottom panel can show **Terminal**, **Search**, and **Serial**.

### Focus & typing

1. **Monaco typing** — Click into Monaco, type. Keys go to the editor (not the terminal).
2. **Search** — `Ctrl+Shift+F`, type a query. Characters appear in Search.
3. **Search ↔ Editor** — Focus follows the surface you click; no “dead” typing.
4. **Terminal inactive while hidden** — Type in Terminal, switch to Output or collapse bottom panel, click Monaco and type. Keys go to Monaco.
5. **Terminal active again** — Show Terminal, click it, type. Keys go to the shell.
6. **Dialogs** — Open Settings, type in a field. Monaco/terminal do not steal keystrokes.

### Open in VS Code

1. With a folder open: File → **Open in VS Code** (or Command Palette). Folder launches in VS Code when CLI is installed.
2. With VS Code missing: expect longer status notice + alert (`vscode.cliMissing` / open failed) — not a silent no-op.
3. Welcome / Settings → Tools paths use the same error mapping.

### Upload / Serial disconnect

1. Connect Serial Monitor to a COM port.
2. Click **Upload** — Serial disconnects first; Output shows the disconnect notice.
3. If another app holds the port (Arduino IDE / second Serial Monitor): first failure shows Access denied hint; Aether disconnects again and **retries once**.
4. Driver/cable banner (CH340 / CP210x) remains available near Serial / Upload.

### Support report

1. Help → **Copy Support Report** / About → copy — clipboard contains version, PIO, env, port, last error, output tail.
2. Help → **Save Support Report…** / About → **Save report…** — save dialog defaults under `Documents/Aether/logs/aether-report-*.txt`; notice shows the path.
3. After a failed Build/Upload: `Documents/Aether/logs/last-error.txt` is overwritten (best-effort).

## Notes

- Collapse uses `hidden` (not unmount) for visited terminal/serial panels so PTY can survive while `disableStdin` is on.
- Playwright against the real WebView2 host is not wired in CI (heavy / fragile on agent machines). Prefer Vitest contracts + this checklist.
- If typing fails only after a specific sequence, note the sequence for a new regression test.
