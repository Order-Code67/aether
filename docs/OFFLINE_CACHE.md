# Offline PlatformIO cache

Aether can pre-download board platforms into the global PlatformIO home directory so the first real project build is faster.

For a **portable zip** (separate from the NSIS installer) and **Import offline cache…**, see [`OFFLINE_INSTALLER.md`](./OFFLINE_INSTALLER.md).

## Where the cache lives

By default:

- Windows: `%USERPROFILE%\.platformio`
- macOS / Linux: `~/.platformio`

Override with the `PLATFORMIO_CORE_DIR` environment variable if needed.

## Prepare from Aether

1. Install PlatformIO Core (Tools Doctor → **Install missing** if needed).
2. Open **Settings → Tools → Offline cache**.
3. Click **Prepare offline cache** / **Подготовить офлайн-кэш**.
4. Watch progress in the **Output** panel.

This runs `pio pkg install -g -p espressif32` and `pio pkg install -g -p atmelavr` (with a `pio platform install …` fallback). Those cover the bundled ESP32 / Mega / Nano examples.

Large toolchains are **not** bundled into the Windows NSIS installer.

## Import a prebuilt zip

**Settings → Tools → Import offline cache…** — pick `Aether_OfflineCache_*_windows-x64.zip`. Contents are merged into `~/.platformio` (platforms + packages only).

## Reuse across machines

Copy the entire `.platformio` folder to the same path on another computer (or set `PLATFORMIO_CORE_DIR` to a shared location). After copying, open Aether and use **Recheck** under Offline cache to confirm `espressif32` and `atmelavr` show as installed.
