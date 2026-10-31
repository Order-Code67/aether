# Aether Ground Station v0.2

Модульная настольная платформа для наземных аппаратных комплексов (Windows 11).

**Стек:** Tauri 2 · React 19 · TypeScript · Vite · Tailwind CSS · Zustand · MapLibre · SQLite (rusqlite)

## Статус этапов

| Этап | Описание | Статус |
|------|----------|--------|
| 1 | Проект, Tauri / React / TypeScript / Vite | **Готово** |
| 2 | Главный интерфейс | **Готово** |
| 3 | Настраиваемые панели Workspace | **Готово** |
| 4 | Hardware Connection Manager | **Готово** |
| 5 | Walksnail / видеозахват | **Готово** |
| 6 | Map Module | **Готово** |
| 7 | ESP32 / Arduino Diagnostics | **Готово** |
| 8 | Device Manager | **Готово** |
| 9 | Профили комплексов | **Готово** |
| 10 | Архив и журнал событий | **Готово** |
| 11 | SQLite и резервное копирование | **Готово** |
| 12 | Windows Installer (NSIS) | **Готово** |
| 13 / v0.3 | Remote Connectivity — архитектура и API | **Готово** (без сервера) |

Архитектура: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · Remote: [`docs/REMOTE_CONNECTIVITY.md`](docs/REMOTE_CONNECTIVITY.md).

## Возможности

- Workspace-шаблоны: Standard / Video / Map / Engineering / Custom; resize, hide/show, persist
- COM/UART, USB, Ethernet (только с разрешения пользователя)
- Видеозахват через реальные MediaDevices (HDMI/USB capture); Walksnail с явным режимом вывода
- MapLibre + OpenStreetMap, метки, измерение дистанций
- JSON-телеметрия ESP32/Arduino (`voltage`/`temperature` могут быть `null`)
- Device Manager, профили (import/export без секретов), архив записей, журнал → SQLite
- Без фиктивных устройств и видеопотоков; без функций боевого управления

## Запуск

```bash
npm install
npm run gs:dev
```

Проверки:

```bash
npm run gs:typecheck
npm run build -w aether-ground-station
npm run gs:build
```

Установщик NSIS: `apps/aether-ground-station/release/Aether Ground Station_0.2.0_x64-setup.exe`  
(также собирается в cargo target `bundle/nsis/` при `npm run gs:build`)

## Принципы

- Устройства только через Connection Manager / адаптеры
- Нет mock-телеметрии и поддельного видео
- Секреты не в plaintext и не в журналах
