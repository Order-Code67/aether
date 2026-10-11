# Aether Configurator

Experimental **Electron** companion for flight-controller setup (MSP + MAVLink scaffold).  
It is **not** the primary FC path in Aether and does **not** replace [БПЛА-Студия](BPLA_STUDIO.md) or the official iNav Configurator.

| Item | Path / command |
|------|----------------|
| App | [`apps/aether-configurator/`](../apps/aether-configurator/) |
| README | [`apps/aether-configurator/README.md`](../apps/aether-configurator/README.md) |
| Dev | `npm run configurator:dev` |
| Build | `npm run configurator:build` |
| Package | `npm run configurator:package` → `apps/aether-configurator/release/` |

## Integration status (Aether IDE)

- **Shipped bridge:** Activity **БПЛА** → launch [БПЛА-Студия](BPLA_STUDIO.md) with optional COM handoff.
- **This Electron app:** monorepo workspace + docs only — no launch button in the IDE yet (avoids claiming a second full product). Use the npm scripts above for local development.

## What works today

Dashboard · Setup · Ports · PID/Rates/Filters · Modes · Motors (safety) · OSD (local layout) · Navigation (local mission + CLI export; FC upload **скоро** / coming soon) · Parameters · Blackbox (header preview) · CLI · Flasher (dfu-util) · Profiles · About

USB-serial driver cache under `apps/aether-configurator/drivers/cache/` is **gitignored** (large binaries). Optional: `drivers/install-serial-drivers.ps1` after you populate the cache locally.

Related: [`docs/BPLA_STUDIO.md`](BPLA_STUDIO.md).
