import { useState } from "react";
import {
  Blocks,
  Bug,
  Cpu,
  Ellipsis,
  Files,
  FolderInput,
  GitBranch,
  Library,
  Plane,
  Search,
  Settings,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import { useLayoutStore } from "@/stores/layoutStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { ACTIVITY_ITEMS, type ActivityId } from "@/types/layout";

const ACTIVITY_ICONS: Record<ActivityId, LucideIcon> = {
  explorer: Files,
  sources: FolderInput,
  search: Search,
  "source-control": GitBranch,
  boards: Cpu,
  libraries: Library,
  doctor: Stethoscope,
  inav: Plane,
  debug: Bug,
  agent: Sparkles,
  extensions: Blocks,
};

/** Hidden behind "More" when Arduino simplified UI is on. */
const ARDUINO_ADVANCED: ReadonlySet<ActivityId> = new Set([
  "source-control",
  "inav",
  "agent",
  "extensions",
]);

export function ActivityBar() {
  const { t } = useI18n();
  const activeActivity = useLayoutStore((s) => s.activeActivity);
  const sidebarVisible = useLayoutStore((s) => s.sidebarVisible);
  const toggleActivity = useLayoutStore((s) => s.toggleActivity);
  const arduinoMode = useSettingsStore((s) => s.arduinoMode);
  const [moreOpen, setMoreOpen] = useState(false);

  const primary = arduinoMode
    ? ACTIVITY_ITEMS.filter((item) => !ARDUINO_ADVANCED.has(item.id))
    : ACTIVITY_ITEMS;
  const advanced = arduinoMode
    ? ACTIVITY_ITEMS.filter((item) => ARDUINO_ADVANCED.has(item.id))
    : [];

  const advancedActive =
    arduinoMode &&
    sidebarVisible &&
    ARDUINO_ADVANCED.has(activeActivity);

  const renderItem = (item: (typeof ACTIVITY_ITEMS)[number]) => {
    const Icon = ACTIVITY_ICONS[item.id];
    const isActive = sidebarVisible && activeActivity === item.id;
    const label = t(item.labelKey);

    return (
      <Tooltip key={item.id} content={t(item.titleKey)} side="right">
        <button
          type="button"
          aria-label={label}
          aria-pressed={isActive}
          onClick={() => {
            toggleActivity(item.id);
            setMoreOpen(false);
          }}
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
      </Tooltip>
    );
  };

  return (
    <aside
      className="flex h-full w-activity shrink-0 flex-col items-center border-r border-aether-border bg-aether-activity py-2"
      aria-label={t("activity.bar")}
    >
      <nav data-aether-chrome className="flex flex-1 flex-col items-center gap-0.5">
        {primary.map(renderItem)}

        {arduinoMode && advanced.length > 0 && (
          <div className="relative">
            <Tooltip content={t("activity.moreTitle")} side="right">
              <button
                type="button"
                aria-label={t("activity.more")}
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((v) => !v)}
                className={cn(
                  "relative flex h-12 w-12 items-center justify-center text-aether-fg-muted transition-colors hover:text-aether-fg",
                  (moreOpen || advancedActive) && "text-aether-fg",
                )}
              >
                <span
                  className={cn(
                    "absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r bg-aether-fg transition-opacity",
                    moreOpen || advancedActive ? "opacity-100" : "opacity-0",
                  )}
                />
                <Ellipsis size={22} strokeWidth={1.5} />
              </button>
            </Tooltip>
            {moreOpen && (
              <div
                className="absolute left-full top-0 z-40 ml-1 flex flex-col gap-0.5 rounded border border-aether-border bg-aether-surface p-1 shadow-lg"
                role="menu"
              >
                {advanced.map((item) => {
                  const Icon = ACTIVITY_ICONS[item.id];
                  const isActive =
                    sidebarVisible && activeActivity === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      title={t(item.titleKey)}
                      onClick={() => {
                        toggleActivity(item.id);
                        setMoreOpen(false);
                      }}
                      className={cn(
                        "flex h-9 items-center gap-2 rounded px-2 text-xs text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg",
                        isActive && "bg-aether-accent-muted text-aether-fg",
                      )}
                    >
                      <Icon size={16} strokeWidth={1.5} />
                      {t(item.labelKey)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </nav>

      <Tooltip content={t("hints.tip.settings")} side="right">
        <button
          type="button"
          data-testid="activity-settings"
          aria-label={t("settings.title")}
          onClick={() => useSettingsStore.getState().openSettings()}
          className="flex h-12 w-12 items-center justify-center text-aether-fg-muted transition-colors hover:text-aether-fg"
        >
          <Settings size={22} strokeWidth={1.5} />
        </button>
      </Tooltip>
    </aside>
  );
}
