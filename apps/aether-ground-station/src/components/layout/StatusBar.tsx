import { useAppStore } from "@/stores/appStore";
import { useAuthStore } from "@/stores/authStore";
import { StatusBadge } from "@/components/common/StatusBadge";
import { isTauriRuntime } from "@/services/tauri";

export function StatusBar() {
  const appInfo = useAppStore((s) => s.appInfo);
  const ready = useAppStore((s) => s.ready);
  const session = useAuthStore((s) => s.session);
  const logout = useAuthStore((s) => s.logout);
  const tauri = isTauriRuntime();

  return (
    <footer className="flex h-8 shrink-0 items-center gap-3 border-t border-ags-border-subtle bg-ags-surface px-3 text-xs text-ags-muted">
      <span className="font-medium text-ags-fg">
        {appInfo?.name ?? "Aether Ground Station"}
      </span>
      <span>v{appInfo?.version ?? "0.3.0"}</span>
      <StatusBadge
        label={ready ? "Готово" : "Загрузка"}
        tone={ready ? "ok" : "warn"}
      />
      <StatusBadge
        label={tauri ? "Tauri" : "Браузер"}
        tone={tauri ? "ok" : "neutral"}
      />
      {session && (
        <StatusBadge
          label={`${session.user.username} · ${session.user.role}`}
          tone="ok"
        />
      )}
      <span className="ml-auto flex items-center gap-2 text-ags-dim">
        <span>ядро · без имитации оборудования</span>
        {session && (
          <button
            type="button"
            className="text-ags-muted hover:text-ags-fg"
            onClick={logout}
          >
            Выход
          </button>
        )}
      </span>
    </footer>
  );
}
