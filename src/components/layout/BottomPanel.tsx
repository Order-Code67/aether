import { useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { DebugConsole } from "@/components/debug/DebugConsole";
import { OutputPanel } from "@/components/platformio/OutputPanel";
import { ProblemsPanel } from "@/components/problems/ProblemsPanel";
import { SerialMonitor } from "@/components/serial/SerialMonitor";
import { TerminalView } from "@/components/terminal/TerminalView";
import { useLayoutStore } from "@/stores/layoutStore";
import { BOTTOM_PANEL_TABS, type BottomPanelTab } from "@/types/layout";
import { cn } from "@/lib/cn";

export function BottomPanel() {
  const visible = useLayoutStore((s) => s.bottomPanelVisible);
  const height = useLayoutStore((s) => s.bottomPanelHeight);
  const activeTab = useLayoutStore((s) => s.bottomPanelTab);
  const setBottomPanelTab = useLayoutStore((s) => s.setBottomPanelTab);
  const setBottomPanelVisible = useLayoutStore((s) => s.setBottomPanelVisible);
  const toggleBottomPanel = useLayoutStore((s) => s.toggleBottomPanel);

  // Keep heavy panels mounted after first visit so PTY/serial sessions survive tab switches.
  const [visited, setVisited] = useState<Record<string, boolean>>({
    [activeTab]: true,
  });

  const visit = (tab: BottomPanelTab) => {
    setVisited((prev) => (prev[tab] ? prev : { ...prev, [tab]: true }));
    setBottomPanelTab(tab);
  };

  if (!visible) {
    return (
      <div className="flex h-8 shrink-0 items-center border-t border-aether-border bg-aether-surface px-2">
        <div className="flex items-center gap-1">
          {BOTTOM_PANEL_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => visit(tab.id)}
              className="px-2 py-1 text-[11px] uppercase tracking-wide text-aether-fg-muted transition-colors hover:text-aether-fg"
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          title="Show Panel"
          aria-label="Show Panel"
          onClick={toggleBottomPanel}
          className="ml-auto flex h-6 w-6 items-center justify-center text-aether-fg-muted hover:text-aether-fg"
        >
          <ChevronUp size={14} />
        </button>
      </div>
    );
  }

  return (
    <section
      className="flex shrink-0 flex-col bg-aether-surface"
      style={{ height }}
      aria-label="Bottom Panel"
    >
      <header className="flex h-8 shrink-0 items-center border-b border-aether-border px-2">
        <div className="flex items-center gap-0.5" role="tablist">
          {BOTTOM_PANEL_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => visit(tab.id)}
                className={cn(
                  "relative px-2.5 py-1 text-[11px] uppercase tracking-wide transition-colors",
                  isActive
                    ? "text-aether-fg"
                    : "text-aether-fg-muted hover:text-aether-fg",
                )}
              >
                {tab.label}
                {isActive && (
                  <span className="absolute inset-x-2 bottom-0 h-px bg-aether-accent" />
                )}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            title="Hide Panel"
            aria-label="Hide Panel"
            onClick={() => setBottomPanelVisible(false)}
            className="flex h-6 w-6 items-center justify-center text-aether-fg-muted hover:text-aether-fg"
          >
            <ChevronDown size={14} />
          </button>
          <button
            type="button"
            title="Close Panel"
            aria-label="Close Panel"
            onClick={() => setBottomPanelVisible(false)}
            className="flex h-6 w-6 items-center justify-center text-aether-fg-muted hover:text-aether-fg"
          >
            <X size={14} />
          </button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden" role="tabpanel">
        {visited.problems && (
          <div
            className={cn(
              "absolute inset-0",
              activeTab === "problems" ? "visible z-10" : "invisible z-0",
            )}
          >
            <ProblemsPanel />
          </div>
        )}

        {visited.output && (
          <div
            className={cn(
              "absolute inset-0",
              activeTab === "output" ? "visible z-10" : "invisible z-0",
            )}
          >
            <OutputPanel />
          </div>
        )}

        {visited.debug && (
          <div
            className={cn(
              "absolute inset-0",
              activeTab === "debug" ? "visible z-10" : "invisible z-0",
            )}
          >
            <DebugConsole />
          </div>
        )}

        {visited.serial && (
          <div
            className={cn(
              "absolute inset-0",
              activeTab === "serial" ? "visible z-10" : "invisible z-0",
            )}
          >
            <SerialMonitor />
          </div>
        )}

        {visited.terminal && (
          <div
            className={cn(
              "absolute inset-0",
              activeTab === "terminal" ? "visible z-10" : "invisible z-0",
            )}
          >
            <TerminalView active={activeTab === "terminal"} />
          </div>
        )}

        {activeTab !== "serial" &&
          activeTab !== "terminal" &&
          activeTab !== "output" &&
          activeTab !== "problems" &&
          activeTab !== "debug" && (
            <div className="aether-scroll h-full overflow-auto px-3 py-2 font-mono text-xs text-aether-fg-muted">
              Panel placeholder.
            </div>
          )}
      </div>
    </section>
  );
}
