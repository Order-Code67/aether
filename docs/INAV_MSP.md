# iNav / MSP notes

> **FC path:** Activity **БПЛА** → **[Aether Configurator](AETHER_CONFIGURATOR.md)** (COM `--port` / `--baud`).  
> Legacy standalone app: [`docs/BPLA_STUDIO.md`](BPLA_STUDIO.md) (not launched from the IDE).

MSP helpers used by the Configurator / residual Aether serial tooling are documented below for implementers.

## Supported (Modes)

| Command | ID | Direction | Use |
|---------|----|-----------|-----|
| `MSP_MODE_RANGES` | 34 | FC → host | Read aux mode slots (4 bytes each) |
| `MSP_SET_MODE_RANGE` | 35 | host → FC | Write one slot (RAM until EEPROM save) |
| `MSP_BOXNAMES` | 116 | FC → host | Mode name strings |
| `MSP_BOXIDS` | 119 | FC → host | Permanent box IDs |
| `MSP_EEPROM_WRITE` | 250 | host → FC | Persist RAM → EEPROM (explicit button only) |

## Ports (serial) — best-effort

| Command | ID | iNav status |
|---------|----|-------------|
| `MSP_CF_SERIAL_CONFIG` | 54 | **Deprecated and unused** on modern iNav |
| `MSP_SET_CF_SERIAL_CONFIG` | 55 | **Deprecated and unused** on modern iNav |

When MSP 54 returns nothing (typical for iNav), Ports falls back to CLI (`serial` / `exit`). Diff backups for the studio go under `Documents/BPLA-Studio/diffs/`.

## Safety

No arm / motor / calibration MSP from the host. Writes confirm + backup; EEPROM save is explicit.
