import { useAppStore } from "@/stores/appStore";
import { StatusBadge } from "@/components/common/StatusBadge";
import { isTauriRuntime } from "@/services/tauri";

export function StatusBar() {
  const appInfo = useAppStore((s) => s.appInfo);
  const ready = useAppStore((s) => s.ready);
  const tauri = isTauriRuntime();

  return (
    <footer className="flex h-8 shrink-0 items-center gap-3 border-t border-ags-border-subtle bg-ags-surface px-3 text-xs text-ags-muted">
      <span className="font-medium text-ags-fg">
        {appInfo?.name ?? "Aether Ground Station"}
      </span>
      <span>v{appInfo?.version ?? "0.2.0"}</span>
      <StatusBadge
        label={ready ? "Готово" : "Загрузка"}
        tone={ready ? "ok" : "warn"}
      />
      <StatusBadge
        label={tauri ? "Tauri" : "Браузер"}
        tone={tauri ? "ok" : "neutral"}
      />
      <span className="ml-auto text-ags-dim">
        v0.2 · без имитации оборудования · модульная платформа
      </span>
    </footer>
  );
}
