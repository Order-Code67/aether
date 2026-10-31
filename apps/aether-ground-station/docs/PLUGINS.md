# Плагины и расширение AGS

## Принципы

1. Плагин не обходит Device Manager и SQLite.
2. Плагин не подставляет фиктивную телеметрию/видео.
3. Remote-плагины не получают канал пилотирования.

## Точки расширения

| Точка | Контракт |
|-------|----------|
| Video adapter | `VideoAdapter` (`listSources` / `open`) |
| Telemetry adapter | `TelemetryAdapter` (`parse` → `NormalizedTelemetry`) |
| Workspace panel | `PanelKind` + регистрация в `PanelHost` |
| Remote service | реализация `RemoteGateway` |
| Device source | upsert в `deviceManager` |

## Workspace constructor

Панели: HTML5 drag-and-drop между колонками, веса, pin/unpin, правая панель настроек выбранного виджета, вкладки layout.

## Профили комплексов

Agriculture / Firefighting / Industrial / Ground Robotics / Monitoring / Custom — через `COMPLEX_PRESETS`.

## Будущий Rust Video Capture Service

Отдельный процесс/crate: FFmpeg RTSP/UVC → кадры в WebView. Frontend остаётся на адаптерах.
