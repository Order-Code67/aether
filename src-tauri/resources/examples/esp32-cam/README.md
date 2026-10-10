# ESP32-CAM (AI-Thinker)

PlatformIO board id: **`esp32cam`**.

Minimal **Wi‑Fi + camera + HTTP `/capture`** sketch for Aether’s Camera panel.

1. Set `WIFI_SSID` / `WIFI_PASS` in `src/main.cpp`.
2. Build & upload (GPIO0 → GND for download mode, then reset).
3. Open Serial Monitor @ **115200** — look for `IP address:` / `Capture URL:`.
4. Bottom panel → **Camera** → Connect (URL autofills from Serial when possible).

## Endpoints

| Path | Description |
|------|-------------|
| `/` | Plain text help |
| `/capture` | Single JPEG snapshot (`image/jpeg`) |

Aether’s Camera view is **JPEG / MJPEG snapshot** preview — not a full RTSP studio.

## Tips

- Use a **5 V** supply that can handle camera peaks; USB-UART adapters often brown out.
- Flash/upload usually needs **GPIO0 → GND**, then reset.
- `monitor_speed = 115200` is already in `platformio.ini`.
- PSRAM improves frame size; without PSRAM the sketch stays on QVGA in DRAM.
