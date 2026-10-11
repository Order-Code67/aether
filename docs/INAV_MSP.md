# iNav / MSP notes

> **Moved:** The full FC configurator lives in **БПЛА-Студия** (`apps/bpla-studio`).  
> See [`docs/BPLA_STUDIO.md`](BPLA_STUDIO.md). Aether only launches that app and can hand off COM (`--port` / `--baud`).

MSP protocol helpers used by the studio (and residual Aether serial tooling) remain documented below for implementers.

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
