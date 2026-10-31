# API адаптеров Aether Ground Station

Адаптеры изолируют протокол производителя / транспорт от UI.

## Device Manager

Единый реестр карточек устройств (`Online` / `Offline` / `Lost` / …).

- Модули USB / COM / Сеть / Видео вызывают `deviceManager.upsert` / `setStatus`.
- Авто-reconnect через `registerReconnectHandler(id, fn)`.
- Снимок устройств пишется в SQLite (`devices_snapshot`).

## Video adapters

| Kind | Назначение | Статус |
|------|------------|--------|
| `mediadevices` | UVC / HDMI capture (WebView2) | Работает |
| `rtsp` | RTSP URL | Ошибка до Video Capture Service (Rust/FFmpeg) |
| `webrtc` | Signaling URL | Ошибка до Video Relay / Gateway |

Запись: blob → выбранная папка (`@tauri-apps/plugin-dialog` + `fs`) + метаданные в SQLite `recordings`.

## Walksnail

Явный `WalksnailOutputMode`: `hdmi-capture` | `usb-capture` | `unspecified`.  
Без режима — «нет устройства»; без кадров — «нет сигнала».

## Telemetry adapters

`normalizeTelemetryLine(raw)` → `NormalizedTelemetry` (deviceLabel, voltageV, temperatureC, warnings).  
UI не парсит JSON производителя напрямую. Экспорт: CSV.

## Network Monitor

Только явно добавленные host:port. Метрики: latency, loss ratio, reconnects. Без автоскана чужих сетей.

## Remote Gateway (v0.3)

Интерфейс `RemoteGateway` в `src/services/remote/types.ts`.  
Режимы: `disabled` | `sandbox` | `integration` (local stub).  
Не передаёт команды пилотирования / боевые функции.
