# Aether Configurator

**Electron** companion for flight-controller setup (MSP + MAVLink).  
Launched from Aether Activity **БПЛА** with COM handoff. Does **not** replace the official iNav Configurator.

| Item | Path / command |
|------|----------------|
| App | [`apps/aether-configurator/`](../apps/aether-configurator/) |
| README | [`apps/aether-configurator/README.md`](../apps/aether-configurator/README.md) |
| Dev | `npm run configurator:dev` |
| Build | `npm run configurator:build` |
| Package | `npm run configurator:package` → `apps/aether-configurator/release/` |

## Integration status (Aether IDE)

- **Arduino-first:** the IDE core stays board → sketch → COM → upload. LoRa is Arduino + radio.
- **БПЛА:** Activity **БПЛА** → **Open Aether Configurator** (detect / launch + COM `--port` / `--baud`).
- **Detect paths (Windows):** `AETHER_CONFIGURATOR` → next to `Aether.exe` → `D:\CFG\Aether\Aether Configurator.exe` → `%LOCALAPPDATA%\Programs\Aether Configurator` → Program Files → PATH.
- Build locally: `npm run configurator:package` → `apps/aether-configurator/release/`.
- **Dist packs:** `npm run package:dist` copies a portable Configurator into `Aether_Dist_*` only if ≤ ~120 MB; larger Electron bundles stay out of the USB pack — README-FIRST documents detect paths instead.
- БПЛА-Студия is **no longer** launched from the IDE.

## What works today

Dashboard · Setup · Ports · PID/Rates/Filters · Modes · Motors (safety) · OSD (local layout) · Navigation (local mission + CLI export; FC upload **скоро** / coming soon) · Parameters · Blackbox (header preview) · CLI · Flasher (dfu-util) · Profiles · About

USB-serial driver cache under `apps/aether-configurator/drivers/cache/` is **gitignored** (large binaries). Optional: `drivers/install-serial-drivers.ps1` after you populate the cache locally.

Related: [`docs/BPLA_STUDIO.md`](BPLA_STUDIO.md).
