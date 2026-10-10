# E2E / UI smoke checklist

Automated coverage:

| Command | What |
|---------|------|
| `npm test` | Vitest unit + integration (CI-friendly) |
| `npm run test:contracts` | Curated Vitest stability suite (focus, upload gate, support report, PIO/VS Code) |
| `npm run test:e2e` | Playwright against **Vite preview** (Welcome / Settings / Command Palette) — no WebView2 |
| `npm run smoke:ui` | Prints this checklist + runs contracts + Playwright |

Full WebView2 focus races and hardware flows still need a short manual pass in `npm run tauri:dev`.

See also `docs/SMOKE.md` for the broader product checklist.

## Automated (Vite / Chromium)

```bash
# One-time (or after Playwright upgrades)
npx playwright install chromium

npm test                 # Vitest
npm run test:contracts   # Focused Vitest contracts
npm run test:e2e         # build + Playwright (starts vite preview on :4173)
npm run test:e2e:ui      # Playwright UI mode (start `npm run preview` or rely on config webServer)
npm run smoke:ui         # Checklist printout + contracts + Playwright
```

Covered automatically:

| Area | Where |
|------|--------|
| Welcome visible, Quick Start / Open Folder CTAs | `e2e/welcome.spec.ts` |
| Settings dialog from activity bar | `e2e/welcome.spec.ts` |
| Command Palette (`Ctrl+Shift+P`) | `e2e/welcome.spec.ts` |
| Monaco / Search / Terminal focus + CSS user-select | `src/lib/focusPolicy.test.ts` |
| Upload blocked / serial disconnect gate + retry policy | `src/lib/uploadGate.test.ts` |
| Support report contents (EN/RU) | `src/lib/supportReport.test.ts` |
| PIO Access denied / open-port friendly messages | `src/lib/pioErrors.test.ts` |
| Open in VS Code invoke error paths | `src/lib/vscodeIntegration.test.ts` |

Stable selectors use `data-testid` / roles (i18n-independent): `welcome-screen`, `welcome-brand`, `welcome-quick-start`, `activity-settings`, `settings-dialog`, `command-palette`.

## Manual (WebView2 / `tauri:dev`)

Playwright does **not** drive the Tauri WebView2 host in CI. Use this path for host-specific behavior:

```bash
npm run tauri:dev
```

Optional semi-auto: with the desktop app running, you can still poke the same UI by hand; there is no headless WebView2 harness wired yet.

### Setup

1. `npm run tauri:dev`
2. Open a folder with a `.cpp` / PlatformIO project so Monaco has a tab.
3. Ensure the bottom panel can show **Terminal**, **Search**, **Serial**, **Plotter**, and **Camera**.

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

### Quick Start

1. Welcome → **Quick start (60s)** (or Help / Command Palette).
2. Walk board → COM → Blink starter → Build+Upload (or Skip).
3. After complete/skip, wizard stays dismissed across restarts (`onboardingDone`).

### Libraries tabs

1. Activity → **Libraries**.
2. Switch **PlatformIO** / **Arduino** / **GitHub** tabs.
3. Arduino tab: search works with `arduino-cli` on PATH, or PlatformIO `framework=arduino` fallback + install hint.
4. GitHub tab: `owner/repo` install path still offered.

### Camera / Plotter basics

1. Bottom panel → **Plotter** — with Serial connected and numeric lines (`temp:23.5` / CSV), channels appear; Pause / Clear / zoom controls respond.
2. Bottom panel → **Camera** — set ESP32-CAM snapshot URL, Connect/Refresh; optional save frame when an image is shown.
3. Without hardware: controls render and errors are visible (no crash).

### Support report

1. Help → **Copy Support Report** / About → copy — clipboard contains version, PIO, env, port, last error, output tail.
2. Help → **Save Support Report…** / About → **Save report…** — save dialog defaults under `Documents/Aether/logs/aether-report-*.txt`; notice shows the path.
3. After a failed Build/Upload: `Documents/Aether/logs/last-error.txt` is overwritten (best-effort).

## Notes

- Collapse uses `hidden` (not unmount) for visited terminal/serial panels so PTY can survive while `disableStdin` is on.
- Playwright targets the **web build** (`vite preview` / `npm run dev`). The Tauri WebView2 host is a documented manual/semi-auto gap — do not expect `test:e2e` to catch native menu or WebView2-only focus races.
- If typing fails only after a specific sequence, note the sequence for a new regression test.
