import {
  Blocks,
  Bug,
  Cpu,
  Files,
  GitBranch,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLayoutStore } from "@/stores/layoutStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { ACTIVITY_ITEMS, type ActivityId } from "@/types/layout";
import { cn } from "@/lib/cn";

const ACTIVITY_ICONS: Record<ActivityId, LucideIcon> = {
  explorer: Files,
  search: Search,
  "source-control": GitBranch,
  boards: Cpu,
  debug: Bug,
  agent: Sparkles,
  extensions: Blocks,
};

export function ActivityBar() {
  const activeActivity = useLayoutStore((s) => s.activeActivity);
  const sidebarVisible = useLayoutStore((s) => s.sidebarVisible);
  const toggleActivity = useLayoutStore((s) => s.toggleActivity);

  return (
    <aside
      className="flex h-full w-activity shrink-0 flex-col items-center border-r border-aether-border bg-aether-activity py-2"
      aria-label="Activity Bar"
    >
      <nav className="flex flex-1 flex-col items-center gap-0.5">
        {ACTIVITY_ITEMS.map((item) => {
          const Icon = ACTIVITY_ICONS[item.id];
          const isActive = sidebarVisible && activeActivity === item.id;

          return (
            <button
              key={item.id}
              type="button"
              title={item.title}
              aria-label={item.label}
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
              <Icon size={22} strokeWidth={1.6} />
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        title="Settings (Ctrl+,)"
        aria-label="Settings"
        onClick={() => {
          useSettingsStore.getState().openSettings();
        }}
        className="flex h-12 w-12 items-center justify-center text-aether-fg-muted transition-colors hover:text-aether-fg"
      >
        <Settings size={22} strokeWidth={1.6} />
      </button>
    </aside>
  );
}
