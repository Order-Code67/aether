# ESP32-CAM (AI-Thinker)

PlatformIO board id: **`esp32cam`**.

This starter blinks the status LED and prints `temp:` / `humidity:` lines for the Serial Plotter. It does **not** initialize the camera stack — add `esp32-camera` (or your preferred library) when you are ready.

## Tips

- Use a **5 V** supply that can handle camera peaks; USB-UART adapters often brown out under load.
- Flash/upload usually needs **GPIO0 → GND** for download mode, then reset.
- Set `monitor_speed = 115200` (already in `platformio.ini`).
