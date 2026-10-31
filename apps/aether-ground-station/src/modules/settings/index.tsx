import { useState } from "react";
import { useAppStore } from "@/stores/appStore";
import { useArchiveStore } from "@/stores/archiveStore";
import { isTauriRuntime } from "@/services/tauri";
import { dbBackup } from "@/services/database";
import { eventBus } from "@/services/events/eventBus";

export function SettingsView() {
  const appInfo = useAppStore((s) => s.appInfo);
  const storageFolder = useArchiveStore((s) => s.storageFolder);
  const setStorageFolder = useArchiveStore((s) => s.setStorageFolder);
  const [backupPath, setBackupPath] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>
        <p className="mt-2 max-w-xl text-sm text-ags-muted">
          Конфигурация платформы. Пароли и секреты не хранятся открытым текстом.
        </p>
      </div>

      <section className="max-w-lg space-y-3 rounded-lg border border-ags-border bg-ags-panel p-4 text-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ags-muted">
          Приложение
        </h2>
        <dl className="grid grid-cols-[10rem_1fr] gap-y-2">
          <dt className="text-ags-dim">Название</dt>
          <dd>{appInfo?.name ?? "Aether Ground Station"}</dd>
          <dt className="text-ags-dim">Версия</dt>
          <dd>{appInfo?.version ?? "0.2.0"}</dd>
          <dt className="text-ags-dim">Этап</dt>
          <dd>{appInfo?.stage ?? "—"}</dd>
          <dt className="text-ags-dim">Среда</dt>
          <dd>{isTauriRuntime() ? "Tauri desktop" : "Браузерный preview"}</dd>
        </dl>
      </section>

      <section className="max-w-lg space-y-3 rounded-lg border border-ags-border bg-ags-panel p-4 text-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ags-muted">
          Архив видео
        </h2>
        <label className="block text-xs text-ags-muted">
          Папка хранения
          <input
            className="mt-1 w-full rounded border border-ags-border bg-ags-elevated px-2 py-1.5 text-ags-fg"
            value={storageFolder}
            onChange={(e) => setStorageFolder(e.target.value)}
            placeholder="D:\\Aether\\Recordings"
          />
        </label>
      </section>

      <section className="max-w-lg space-y-3 rounded-lg border border-ags-border bg-ags-panel p-4 text-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ags-muted">
          Резервное копирование
        </h2>
        <button
          type="button"
          className="rounded bg-ags-accent px-3 py-1.5 text-white disabled:opacity-40"
          disabled={!isTauriRuntime()}
          onClick={() => {
            void dbBackup().then((path) => {
              setBackupPath(path);
              eventBus.emit(
                "info",
                "database",
                path ? `Резервная копия: ${path}` : "Бэкап недоступен",
              );
            });
          }}
        >
          Создать копию SQLite
        </button>
        {backupPath && (
          <p className="font-mono text-xs text-ags-muted">{backupPath}</p>
        )}
      </section>

      <section className="max-w-lg space-y-2 rounded-lg border border-ags-border bg-ags-panel p-4 text-sm text-ags-muted">
        <h2 className="text-xs font-semibold uppercase tracking-wider">
          Безопасность
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-xs">
          <li>Секреты не попадают в журналы</li>
          <li>Сканирование оборудования — только с разрешения</li>
          <li>Плагины без произвольного доступа к ОС (этап SDK)</li>
        </ul>
      </section>
    </div>
  );
}
