# БПЛА-Студия

Standalone Tauri app for configuring FPV drones and airplanes (iNav, Betaflight, ArduPilot targets).

> **IDE note (2026-10):** Aether no longer launches БПЛА-Студия. The Activity **БПЛА** bridge targets **[Aether Configurator](AETHER_CONFIGURATOR.md)** (`AETHER_CONFIGURATOR`). This app remains in the monorepo for optional standalone builds (`npm run studio:build`).

## Locations

| Item | Path |
|------|------|
| App source | [`apps/bpla-studio/`](../apps/bpla-studio/) |
| Dev | `npm run studio:dev` (from repo root) |
| Build installer | `npm run studio:build` → NSIS under `apps/bpla-studio/src-tauri/target/release/bundle/` |
| Diff backups | `Documents/BPLA-Studio/diffs/` |

## Aether IDE

The IDE **no longer** detects or launches this app. Use Activity **БПЛА** → **[Aether Configurator](AETHER_CONFIGURATOR.md)** instead.

To run БПЛА-Студия standalone from the monorepo:

```bash
npm run studio:dev
npm run studio:build
```

## Firmware families & boards

Sidebar switcher: **iNav** / **Betaflight** / **ArduPilot**. Board catalog: [`apps/bpla-studio/src/data/boards.json`](../apps/bpla-studio/src/data/boards.json) (curated MVP list; extend freely).

## Safety

Same policy as before: no arm / motor spin from the host. Writes confirm + backup; EEPROM save is explicit.
