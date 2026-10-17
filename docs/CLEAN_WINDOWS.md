# Clean Windows → first flash (< 15 minutes)

Goal: on a fresh PC, **install → open → build → flash** without hunting registries.

The **NSIS setup stays lean** (app only). Put `Aether_OfflineLibs_*.zip` beside it — never expect multi‑GB toolchains inside the installer. See [`SIGNING_AND_RELEASES.md`](./SIGNING_AND_RELEASES.md).

## What you need

| Item | Source |
|------|--------|
| Aether installer | `Aether_<ver>_x64-setup.exe` (GitHub Release) |
| Offline pack (recommended) | `Aether_OfflineLibs_*.zip` (~50–80 MB) or full `Aether_OfflineCache_*.zip` (multi‑GB, platforms + toolchains) |
| Board + USB cable | ESP32 / Mega / Heltec / … |
| COM driver | CH340 / CP210x if Windows does not auto-install |
| Aether Configurator (optional, FC) | Detected at `D:\CFG\Aether`, `%LOCALAPPDATA%\Programs\Aether Configurator`, next to `Aether.exe`, or `AETHER_CONFIGURATOR`. Full Electron pack is often too large for USB — see below. |

USB-stick layout (from `npm run package:dist`):

```
Aether_Dist_<ver>/
  Aether_<ver>_x64-setup.exe
  Aether_OfflineLibs_<ver>_windows-x64.zip
  README-FIRST.txt
  CLEAN_WINDOWS.md
  Aether Configurator.exe   # only if a portable build ≤ ~120 MB was found
```

## Steps (~15 min)

1. **Install** — run the setup; pick any drive/folder (`D:\Apps\Aether` OK). Choose *All users* for a Public Desktop shortcut.
2. **Launch** — open Aether from the desktop shortcut.
3. **PlatformIO** — Tools Doctor → **Install missing** (needs Python). Wait until PIO shows OK.
4. **Offline pack** — put `Aether_OfflineLibs_*.zip` (or OfflineCache) next to the app, on Desktop, or in Downloads. Doctor / Settings → Tools shows **Import offline pack**. Click it (progress in Output).
   - Online alternative: Settings → Tools → **Prepare offline cache** (downloads espressif32 + atmelavr; slower).
5. **Example** — Welcome → **Examples…** → `esp32-blink` (or Mega Servo). Copies to `Documents\Aether\examples\…`.
6. **COM + Upload** — plug the board, pick the COM port, **Build + Upload**.

### Arduino CLI (optional)

- Settings → Tools: install **arduino-cli**, then **Install AVR + ESP32 cores**.
- Build toolbar: switch **Build tool** to Arduino CLI (choice is **remembered per project folder**).
- On first Build/Upload, Aether verifies the FQBN core and installs it if missing (`arduino:avr`, `esp32:esp32`, …).
- Unmapped boards show a clear RU/EN error — switch back to PlatformIO or use a common Arduino/ESP board.

### Aether Configurator (БПЛА)

1. Activity **БПЛА** → pick COM → **Open Aether Configurator**.
2. Detection order: `AETHER_CONFIGURATOR` env → next to `Aether.exe` → `D:\CFG\Aether\` → `%LOCALAPPDATA%\Programs\` → Program Files.
3. If missing: `npm run configurator:package` → copy portable `.exe` next to Aether, into `D:\CFG\Aether`, or set `AETHER_CONFIGURATOR`.
4. **Size note:** a full Electron `win-unpacked` / portable build is often **hundreds of MB**. `package-dist.ps1` copies a portable Configurator into `Aether_Dist_*` only when it is under ~120 MB; otherwise README-FIRST documents detect paths and leaves bundling to you.

Quick Start wizard (Welcome → Quick start) covers board → COM → Blink → upload in about a minute once PIO and platforms are ready.

Hints mode (Status Bar) adds **scenario checklists**: First Blink · LoRa TX↔RX · UAV → Configurator.

## Timing notes

| Step | Online PC | Offline + OfflineLibs | Offline + full OfflineCache |
|------|-----------|------------------------|-----------------------------|
| Install Aether | ~1 min | ~1 min | ~1 min |
| PIO Core | ~2–4 min | ~2–4 min | ~2–4 min |
| Platforms/libs | ~5–15 min (download) | libs fast; first build may still fetch toolchain | ~2–5 min import |
| Blink upload | ~1–2 min | ~1–2 min (+ toolchain if missing) | ~1–2 min |

Full offline (no registry) needs **`Aether_OfflineCache_*`**, not only offlineLibs.

## Maintainers

```powershell
npm run tauri:build
npm run build:offline-cache -- -LibsOnly   # or full pack without -LibsOnly
npm run configurator:package               # optional FC companion
npm run package:dist
# Skip Configurator copy: .\scripts\package-dist.ps1 -SkipConfigurator
```

See also [`OFFLINE_INSTALLER.md`](./OFFLINE_INSTALLER.md), [`AETHER_CONFIGURATOR.md`](./AETHER_CONFIGURATOR.md).
