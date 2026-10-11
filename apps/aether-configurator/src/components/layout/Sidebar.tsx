import {
  Activity,
  Compass,
  Cpu,
  Crosshair,
  Gauge,
  HardDrive,
  Info,
  Layers,
  Map,
  Radio,
  Settings2,
  Terminal,
  Upload,
  Waypoints,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { useI18n } from "@/hooks/useI18n";
import { useUiStore } from "@/stores/uiStore";
import type { TabId } from "@/core/plugins/types";
import type { MessageKey } from "@/i18n";

const NAV: { id: TabId; icon: LucideIcon; labelKey: MessageKey }[] = [
  { id: "dashboard", icon: Activity, labelKey: "tabs.dashboard" },
  { id: "setup", icon: Settings2, labelKey: "tabs.setup" },
  { id: "ports", icon: Radio, labelKey: "tabs.ports" },
  { id: "pid", icon: Gauge, labelKey: "tabs.pid" },
  { id: "modes", icon: Layers, labelKey: "tabs.modes" },
  { id: "motors", icon: Cpu, labelKey: "tabs.motors" },
  { id: "osd", icon: Crosshair, labelKey: "tabs.osd" },
  { id: "navigation", icon: Map, labelKey: "tabs.navigation" },
  { id: "parameters", icon: Waypoints, labelKey: "tabs.parameters" },
  { id: "blackbox", icon: HardDrive, labelKey: "tabs.blackbox" },
  { id: "cli", icon: Terminal, labelKey: "tabs.cli" },
  { id: "flasher", icon: Upload, labelKey: "tabs.flasher" },
  { id: "profiles", icon: Compass, labelKey: "tabs.profiles" },
  { id: "about", icon: Info, labelKey: "tabs.about" },
];

export function Sidebar() {
  const { t } = useI18n();
  const activeTab = useUiStore((s) => s.activeTab);
  const setActiveTab = useUiStore((s) => s.setActiveTab);
  const collapsed = useUiStore((s) => s.sidebarCollapsed);

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-border bg-surface/60 backdrop-blur transition-[width]",
        collapsed ? "w-[64px]" : "w-[220px]",
      )}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-3">
        <img
          src="/branding/logo.svg"
          alt=""
          className="h-8 w-8 shrink-0"
        />
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight">
              Aether
            </div>
            <div className="truncate text-[10px] uppercase tracking-[0.14em] text-fg-muted">
              Configurator
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-2" aria-label="Main">
        {NAV.map(({ id, icon: Icon, labelKey }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={cn(
                "mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition",
                active
                  ? "bg-accent/15 text-accent"
                  : "text-fg-muted hover:bg-surface-2 hover:text-fg",
              )}
              title={t(labelKey)}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{t(labelKey)}</span>}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
