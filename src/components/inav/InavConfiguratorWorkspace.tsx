import { Plane } from "lucide-react";
import { InavPanel } from "@/components/inav/InavPanel";
import { InavSessionHud } from "@/components/inav/InavSessionHud";
import { useI18n } from "@/hooks/useI18n";
import type { MessageKey } from "@/i18n";
import { INAV_CONFIGURATOR_TABS } from "@/lib/inavTabs";
import { isTauriRuntime } from "@/lib/tauri";
import { useInavStore } from "@/stores/inavStore";

/**
 * Full main-area FC Configurator (like Betaflight / iNav Configurator).
 * Connect through Aether via the left sidebar; pages render here.
 */
export function InavConfiguratorWorkspace() {
  const { t } = useI18n();
  const tauri = isTauriRuntime();
  const activeTab = useInavStore((s) => s.activeTab);
  const tabMeta = INAV_CONFIGURATOR_TABS.find((x) => x.id === activeTab);
  const tabLabel = tabMeta ? t(tabMeta.labelKey as MessageKey) : "";

  if (!tauri) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-2 px-6 text-sm text-aether-fg-dim"
        data-testid="inav-configurator-workspace"
      >
        <Plane size={28} className="text-aether-accent" />
        <p className="font-medium text-aether-fg">{t("inav.title")}</p>
        <p>{t("inav.desktopRequired")}</p>
        <span className="font-mono text-xs text-aether-fg-muted">
          npm run tauri:dev
        </span>
      </div>
    );
  }

  return (
    <section
      className="flex h-full min-h-0 w-full flex-col bg-aether-bg"
      aria-label={t("inav.title")}
      data-testid="inav-configurator-workspace"
    >
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-aether-border px-4">
        <Plane size={16} className="text-aether-accent" />
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-aether-fg">
            {t("inav.title")}
          </h1>
          <p className="truncate text-[10px] text-aether-fg-dim">
            {t("inav.workspaceSubtitle", { tab: tabLabel })}
          </p>
        </div>
      </header>
      <InavSessionHud />
      <div className="min-h-0 flex-1">
        <InavPanel />
      </div>
    </section>
  );
}
