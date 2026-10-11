# iNav / FC Configurator notes (Aether)

Aether’s **FC Configurator** is a full main-window workspace: connect the flight controller **through Aether** (Activity → FC Config → Connect via Aether). No external Electron app is required for day-to-day setup.

It talks to iNav (and compatible MSP) flight controllers over the same COM session used for FC CLI. It combines:

| Source | What we take |
|--------|----------------|
| **iNav Configurator** | Status, Ports, Modes, GPS/Nav, airplane/wing mixer, CLI diff, DFU flash |
| **Betaflight Configurator** | PID table, rates/expo/TPA, live RX channel bars, feature chips |
| **ArduPilot / Mission Planner** | Searchable parameter tree, vehicle presets, RTH-first failsafe philosophy |

Safety: no arm / motor / calibration MSP. Writes confirm + auto-backup under `Documents/Aether/drones/diffs/`. EEPROM is never implied.

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

Aether **probes** 54 first. When the FC returns nothing (typical for iNav), Ports falls back to CLI:

```
#          → enter CLI
serial     → list UART function masks + baud rates
exit       → leave CLI
```

Writes use the same CLI `serial <id> <mask> <msp> <gps> <telem> <bb>` form, after an automatic text backup under `Documents/Aether/drones/diffs/`.

There is no dedicated MSP2 serial-config command in current iNav headers (`msp_protocol_v2_inav.h`). Prefer the official Configurator for complex UART layouts.

## Safety

- No arm / motor / calibration MSP commands.
- Writes require a confirm dialog.
- EEPROM save is a separate confirm (never implied by Ports/Modes Apply).
- Before flash DFU, Aether disconnects serial.
