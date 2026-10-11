import { useEffect } from "react";
import { BoardsPanel } from "@/components/BoardsPanel";
import { InavConfiguratorWorkspace } from "@/components/inav/InavConfiguratorWorkspace";
import { InavSidebarNav } from "@/components/inav/InavSidebarNav";
import { useI18n } from "@/hooks/useI18n";
import { applyAetherHandoff } from "@/lib/cliHandoff";
import { useSettingsStore } from "@/stores/settingsStore";
import { detectDefaultLocale } from "@/i18n";
import { useSerialBridge } from "@/hooks/useSerialBridge";

export default function App() {
  const { t } = useI18n();
  const notice = useSettingsStore((s) => s.notice);
  const locale = useSettingsStore((s) => s.locale);
  const setLocale = useSettingsStore((s) => s.setLocale);
  useSerialBridge();

  useEffect(() => {
    // First launch: respect OS language if persist empty default.
    const stored = localStorage.getItem("bpla-studio-settings");
    if (!stored) setLocale(detectDefaultLocale());
  }, [setLocale]);

  useEffect(() => {
    void applyAetherHandoff();
  }, []);

  return (
    <div className="flex h-full w-full flex-col bg-aether-bg text-aether-fg">
      <div className="flex min-h-0 flex-1">
        <aside
          className="flex w-[260px] shrink-0 flex-col border-r border-aether-border bg-aether-surface"
          aria-label={t("studio.title")}
        >
          <div className="flex items-center justify-between gap-2 border-b border-aether-border px-3 py-2">
            <span className="text-xs font-semibold text-aether-fg">
              {t("app.name")}
            </span>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as "en" | "ru")}
              className="h-6 rounded border border-aether-border bg-aether-bg px-1 text-[10px] text-aether-fg"
              aria-label="Language"
            >
              <option value="ru">RU</option>
              <option value="en">EN</option>
            </select>
          </div>
          <BoardsPanel />
          <div className="min-h-0 flex-1">
            <InavSidebarNav />
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <InavConfiguratorWorkspace />
        </main>
      </div>
      {notice && (
        <div className="shrink-0 border-t border-aether-border bg-aether-status px-3 py-1 text-[11px] text-white">
          {notice}
        </div>
      )}
    </div>
  );
}
