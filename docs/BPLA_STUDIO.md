# БПЛА-Студия

Standalone Tauri app for configuring FPV drones and airplanes (iNav, Betaflight, ArduPilot targets). **Aether is the IDE** — it only detects/launches the studio and can pass a COM port.

## Locations

| Item | Path |
|------|------|
| App source | [`apps/bpla-studio/`](../apps/bpla-studio/) |
| Dev | `npm run studio:dev` (from repo root) |
| Build installer | `npm run studio:build` → NSIS under `apps/bpla-studio/src-tauri/target/release/bundle/` |
| Diff backups | `Documents/BPLA-Studio/diffs/` |

## Aether bridge

1. Activity **БПЛА** (or Welcome Hub → БПЛА-Студия)
2. Optional: select COM + baud
3. **Open БПЛА-Студия** — Aether releases the serial port and launches:

```text
БПЛА-Студия.exe --port COMx --baud 115200
```

Detection order (Windows): `AETHER_BPLA_STUDIO` env → next to Aether.exe → `%LOCALAPPDATA%\Programs\…` → Program Files → PATH → monorepo `apps/bpla-studio/src-tauri/target/release`.

## Firmware families & boards

Sidebar switcher: **iNav** / **Betaflight** / **ArduPilot**. Board catalog: [`apps/bpla-studio/src/data/boards.json`](../apps/bpla-studio/src/data/boards.json) (curated MVP list; extend freely).

## Safety

Same policy as before: no arm / motor spin from the host. Writes confirm + backup; EEPROM save is explicit.
