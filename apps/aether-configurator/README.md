# Aether Configurator

Experimental desktop FC companion inspired by **Betaflight**, **iNav**, and **ArduPilot**.  
**Not affiliated** with those projects.

**Aether IDE:** Arduino-first. Activity **БПЛА** launches this Configurator with COM handoff (`AETHER_CONFIGURATOR`).

**Stack:** Electron · React 19 · TypeScript · Vite · Tailwind CSS · Zustand · MSP · MAVLink · IndexedDB · dfu-util

## Status

| Area | State |
|------|--------|
| Serial / TCP / UDP + MSP dashboard | Working |
| Setup, Ports, PID, Modes, Motors, CLI, Flasher | Working (RAM writes → CLI `save`) |
| OSD / Profiles | Local editor / IndexedDB |
| Navigation | Local mission + CLI export; FC upload **скоро** / coming soon |
| Blackbox | Header preview only |
| IDE integration | Activity **БПЛА** → Open Aether Configurator (COM `--port` / `--baud`) |

## Requirements

| OS | Dependencies |
|----|----------------|
| **Windows** | Node.js 20+, VS Build Tools (C++ for `serialport`), Python 3; optional `dfu-util` |
| **macOS** | Node.js 20+, Xcode CLT; `brew install dfu-util` |
| **Linux** | Node.js 20+, `build-essential`, `libudev-dev`; `sudo apt install dfu-util` |

## Run (from Aether repo root)

```bash
npm install
npm run configurator:dev
```

Or:

```bash
cd apps/aether-configurator
npm install
npm run rebuild:native   # serialport for Electron
npm run dev
npm run package          # → release/
```

| Command | Purpose |
|---------|---------|
| `npm run dev` | Hot-reload UI + Electron |
| `npm run build` | Production build |
| `npm run package` | Installers (electron-builder) |
| `npm run typecheck` | TypeScript |

## Safety

- Calibration / PID / Modes / Ports write **RAM only** → CLI `save`
- **Motors**: props-off checkbox, master enable + timeout, PWM cap 1150, stop on tab leave
- **Flasher**: closes serial before DFU; confirm before flash

## Drivers

Optional helper: [`drivers/install-serial-drivers.ps1`](drivers/install-serial-drivers.ps1). Vendor caches under `drivers/cache/` are gitignored — see [`drivers/README.md`](drivers/README.md).

## Docs

[`docs/AETHER_CONFIGURATOR.md`](../../docs/AETHER_CONFIGURATOR.md)
