# Pixhawk / ArduPilot (stub)

**This is a placeholder template**, not a complete ArduPilot IDE.

Aether focuses on PlatformIO / Arduino-style firmware. Autopilot work usually lives in the ArduPilot tree with its own build (`waf`, Docker, or SITL).

## Suggested next steps

1. Clone [ArduPilot](https://github.com/ArduPilot/ardupilot) and follow the official setup guide for your OS.
2. For simulation, use **SITL** (`sim_vehicle.py`) rather than uploading from this stub.
3. Keep hardware wiring, parameter files, and MAVLink GCS tools outside this folder until you integrate them deliberately.

The bundled `platformio.ini` only exists so Aether can open the folder as a project root and show Environments.
