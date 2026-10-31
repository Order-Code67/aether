# Выпуск AGS

## Версия

Синхронизировать `package.json` и `src-tauri/tauri.conf.json`.

## Сборка установщика

```bash
npm run tauri:build
```

Артефакт NSIS: `src-tauri/target/release/bundle/nsis/Aether Ground Station_*_x64-setup.exe`

## Подпись NSIS

Для production: сертификат Authenticode + `tauri.conf.json` → `bundle.windows.certificateThumbprint` / CI secrets.  
Без сертификата локальная сборка остаётся неподписанной.

## Автообновление

Планируется через `@tauri-apps/plugin-updater` + подписанные релизы на GitHub Releases.  
Пока обновление — ручная переустановка установщика.

## Smoke после установки

```powershell
npm run smoke:install
```

Проверяет EXE в `%LOCALAPPDATA%\Programs\Aether Ground Station\`, ярлык на рабочем столе и краткий запуск процесса.

## Автотесты критичных путей

```bash
npm run test:critical
```
