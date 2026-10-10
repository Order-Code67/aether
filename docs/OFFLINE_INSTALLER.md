# Offline PlatformIO cache package

Large ESP32 / AVR toolchains are **not** embedded in the main Aether NSIS installer. Ship (or build) a **separate** offline cache zip and import it in the app.

## What’s in the package

`Aether_OfflineCache_<version>_windows-x64.zip` contains a merge-friendly slice of PlatformIO home:

- `platforms/espressif32`
- `platforms/atmelavr`
- `packages/…` (toolchains and frameworks pulled in by those platforms)
- `aether-offline-cache.json` (manifest)

Target install location (merge, do not wipe unrelated packages):

- Windows: `%USERPROFILE%\.platformio`
- Override: `PLATFORMIO_CORE_DIR`

## Build the pack (maintainers)

Prerequisites: PlatformIO Core (`pio` on PATH or `~/.platformio/penv`).

From the repo root:

```powershell
npm run build:offline-cache
# or
.\scripts\build-offline-cache.ps1 -Version 0.2.15
```

The script:

1. Uses a clean staging `PLATFORMIO_CORE_DIR` under `%TEMP%`
2. Runs `pio pkg install -g -p espressif32` and `atmelavr` (with `pio platform install` fallback)
3. Writes `release/Aether_OfflineCache_<ver>_windows-x64.zip`

This can take a long time and produce a multi‑GB archive. If GitHub’s **2 GB** release asset limit is exceeded, keep the zip local / on external storage and do **not** attach it to the release — users build or copy the pack themselves.

Optional: `-SkipInstall` packs an existing staging dir without re-downloading.

## Install for users

### A) In Aether (recommended)

1. Install Aether and PlatformIO Core (Tools Doctor → **Install missing** if needed).
2. Download `Aether_OfflineCache_*_windows-x64.zip` (from the GitHub Release when attached, or built locally).
3. **Settings → Tools → Offline cache → Import offline cache…**
4. Pick the zip. Progress streams in the **Output** panel.
5. Confirm `espressif32` / `atmelavr` show as installed (Recheck).

Import **merges** into `~/.platformio`; it does not delete other platforms or packages.

### B) Online prepare (no zip)

**Settings → Tools → Prepare offline cache** downloads the same platforms via `pio` when the machine has internet (see also [`OFFLINE_CACHE.md`](./OFFLINE_CACHE.md)).

### C) Manual copy

Extract the zip so that `platforms/` and `packages/` land inside `%USERPROFILE%\.platformio` (merge folders). Or copy an entire existing `.platformio` tree from another PC.

## GitHub Releases

- Always ship the **signed** main installer + `latest.json` / `latest-beta.json`.
- Attach the offline zip **only when** size is under ~2 GB.
- If omitted, this document + `scripts/build-offline-cache.ps1` remain the source of truth.
