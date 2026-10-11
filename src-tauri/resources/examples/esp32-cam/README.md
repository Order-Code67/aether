# ESP32-CAM (AI-Thinker)

PlatformIO board id: **`esp32cam`** (AI-Thinker pinout).

Wi‑Fi + camera sketch for Aether’s **Camera** panel: JPEG **`/capture`** and MJPEG **`/stream`**.

## Power (important)

Use a **stable 5 V** supply that can handle camera peaks (typically **≥ 1 A** on the board **5V** pin, common ground).

- USB-UART adapters often **cannot** supply enough current → **brownouts**, failed `esp_camera_init`, random resets, Wi‑Fi drops.
- If the chip resets under load, treat it as a **power** issue (brownout detector), not a sketch bug.
- Prefer an external 5 V regulator / bench supply for reliable streaming.

## Setup

1. Set `WIFI_SSID` / `WIFI_PASS` in `src/main.cpp`.
2. Build & upload (GPIO0 → GND for download mode, then reset).
3. Open Serial Monitor @ **115200** — look for:
   - `IP address:`
   - `Capture URL: http://…/capture` (Aether autofills this)
   - `Stream URL: http://…/stream`
4. Bottom panel → **Camera** → Connect.

## Endpoints

| Path | Description |
|------|-------------|
| `/` | Plain text help |
| `/capture` | Single JPEG snapshot (`image/jpeg`) |
| `/stream` | MJPEG multipart stream |

Aether’s Camera view is **JPEG / MJPEG snapshot** preview — not a full RTSP studio. For continuous preview, point the URL at `/stream` or use Auto-refresh on `/capture`.

## Tips

- Flash/upload usually needs **GPIO0 → GND**, then reset.
- `monitor_speed = 115200` is already in `platformio.ini`.
- PSRAM improves frame size; without PSRAM the sketch stays on QVGA in DRAM.
