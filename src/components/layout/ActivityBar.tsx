import {
  Blocks,
  Bug,
  Cpu,
  Files,
  GitBranch,
  Library,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import { useLayoutStore } from "@/stores/layoutStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { ACTIVITY_ITEMS, type ActivityId } from "@/types/layout";

const ACTIVITY_ICONS: Record<ActivityId, LucideIcon> = {
  explorer: Files,
  search: Search,
  "source-control": GitBranch,
  boards: Cpu,
  libraries: Library,
  debug: Bug,
  agent: Sparkles,
  extensions: Blocks,
};

export function ActivityBar() {
  const { t } = useI18n();
  const activeActivity = useLayoutStore((s) => s.activeActivity);
  const sidebarVisible = useLayoutStore((s) => s.sidebarVisible);
  const toggleActivity = useLayoutStore((s) => s.toggleActivity);

  return (
    <aside
      className="flex h-full w-activity shrink-0 flex-col items-center border-r border-aether-border bg-aether-activity py-2"
      aria-label={t("activity.bar")}
    >
      <nav data-aether-chrome className="flex flex-1 flex-col items-center gap-0.5">
        {ACTIVITY_ITEMS.map((item) => {
          const Icon = ACTIVITY_ICONS[item.id];
          const isActive = sidebarVisible && activeActivity === item.id;
          const label = t(item.labelKey);

          return (
            <button
              key={item.id}
              type="button"
              title={t(item.titleKey)}
              aria-label={label}
              aria-pressed={isActive}
              onClick={() => toggleActivity(item.id)}
              className={cn(
                "relative flex h-12 w-12 items-center justify-center text-aether-fg-muted transition-colors",
                "hover:text-aether-fg",
                isActive && "text-aether-fg",
              )}
            >
              <span
                className={cn(
                  "absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r bg-aether-fg transition-opacity",
                  isActive ? "opacity-100" : "opacity-0",
                )}
              />
              <Icon size={22} strokeWidth={1.5} />
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        title={t("settings.title")}
        aria-label={t("settings.title")}
        onClick={() => useSettingsStore.getState().openSettings()}
        className="flex h-12 w-12 items-center justify-center text-aether-fg-muted transition-colors hover:text-aether-fg"
      >
        <Settings size={22} strokeWidth={1.5} />
      </button>
    </aside>
  );
}
