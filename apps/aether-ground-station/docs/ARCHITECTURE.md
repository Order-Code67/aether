# Aether Ground Station v0.2 — Архитектура

## Цель

Универсальная платформа Windows 11 для подключения и мониторинга наземных комплексов (Walksnail, IP/capture, ESP32, Arduino, сеть, карта). Новые устройства — через адаптеры, без переписывания ядра.

Вне объёма: боевое управление БПЛА, наведение, целеуказание, поражение.

## Стек

Tauri 2 · React 19 · TypeScript · Vite · Tailwind · Zustand · MapLibre · SQLite (rusqlite) · serialport · nusb · MediaDevices

## Модули UI

`workspace` · `video` · `walksnail` · `map` · `devices` · `network` · `usb` · `serial` · `telemetry` · `archive` · `profiles` · `settings`

## Backend (`src-tauri`)

- `hardware/serial` — COM list/open/read/write + события `serial-data`
- `hardware/usb` — enumeration (nusb)
- `hardware/ethernet` — локальные IPv4 + TCP probe (без автоскана сети)
- `database/sqlite` — profiles/layouts/events/settings + backup

## Правила данных

- Нет фиктивных устройств и видеопотоков
- `null` для отсутствующих датчиков
- Сканирование COM/USB/сети только с разрешения
- Секреты не в plaintext и не в логах
