import { useI18n } from "@/hooks/useI18n";
import type { MessageKey } from "@/i18n";
import { cn } from "@/lib/cn";
import {
  INAV_CONFIGURATOR_TABS,
  type InavConfiguratorTab,
} from "@/components/inav/inavTabs";

interface Props {
  active: InavConfiguratorTab;
  onChange: (tab: InavConfiguratorTab) => void;
}

export function InavTabBar({ active, onChange }: Props) {
  const { t } = useI18n();
  return (
    <div
      className="aether-scroll flex shrink-0 gap-0.5 overflow-x-auto border-b border-aether-border px-2 pb-1"
      data-testid="inav-tab-bar"
      role="tablist"
      aria-label={t("inav.tabsAria")}
    >
      {INAV_CONFIGURATOR_TABS.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            data-testid={`inav-tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={cn(
              "shrink-0 rounded px-2 py-1 text-[10px] font-medium uppercase tracking-wide",
              selected
                ? "bg-aether-accent-muted text-aether-fg"
                : "text-aether-fg-dim hover:bg-aether-surface-raised hover:text-aether-fg",
            )}
          >
            {t(tab.labelKey as MessageKey)}
          </button>
        );
      })}
    </div>
  );
}
