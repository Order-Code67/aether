# Clean Windows → first flash (< 15 minutes)

Goal: on a fresh PC, **install → open → build → flash** without hunting registries.

## What you need

| Item | Source |
|------|--------|
| Aether installer | `Aether_<ver>_x64-setup.exe` (GitHub Release) |
| Offline pack (recommended) | `Aether_OfflineLibs_*.zip` (~50–80 MB) or full `Aether_OfflineCache_*.zip` (multi‑GB, platforms + toolchains) |
| Board + USB cable | ESP32 / Mega / Heltec / … |
| COM driver | CH340 / CP210x if Windows does not auto-install |

USB-stick layout (from `npm run package:dist`):

```
Aether_Dist_<ver>/
  Aether_<ver>_x64-setup.exe
  Aether_OfflineLibs_<ver>_windows-x64.zip
  README-FIRST.txt
```

## Steps (~15 min)

1. **Install** — run the setup; pick any drive/folder (`D:\Apps\Aether` OK). Choose *All users* for a Public Desktop shortcut.
2. **Launch** — open Aether from the desktop shortcut.
3. **PlatformIO** — Tools Doctor → **Install missing** (needs Python). Wait until PIO shows OK.
4. **Offline pack** — put `Aether_OfflineLibs_*.zip` (or OfflineCache) next to the app, on Desktop, or in Downloads. Doctor / Settings → Tools shows **Import offline pack**. Click it (progress in Output).
   - Online alternative: Settings → Tools → **Prepare offline cache** (downloads espressif32 + atmelavr; slower).
5. **Example** — Welcome → **Examples…** → `esp32-blink` (or Mega Servo). Copies to `Documents\Aether\examples\…`.
6. **COM + Upload** — plug the board, pick the COM port, **Build + Upload**.

Quick Start wizard (Welcome → Quick start) covers board → COM → Blink → upload in about a minute once PIO and platforms are ready.

## Timing notes

| Step | Online PC | Offline + OfflineLibs | Offline + full OfflineCache |
|------|-----------|------------------------|-----------------------------|
| Install Aether | ~1 min | ~1 min | ~1 min |
| PIO Core | ~2–4 min | ~2–4 min | ~2–4 min |
| Platforms/libs | ~5–15 min (download) | libs fast; first build may still fetch toolchain | ~2–5 min import |
| Blink upload | ~1–2 min | ~1–2 min (+ toolchain if missing) | ~1–2 min |

Full offline (no registry) needs **`Aether_OfflineCache_*`**, not only OfflineLibs.

## Maintainers

```powershell
npm run tauri:build
npm run build:offline-cache -- -LibsOnly   # or full pack without -LibsOnly
npm run package:dist
```

See also [`OFFLINE_INSTALLER.md`](./OFFLINE_INSTALLER.md).
