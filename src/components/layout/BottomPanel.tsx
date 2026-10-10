import { useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { DebugConsole } from "@/components/debug/DebugConsole";
import { OutputPanel } from "@/components/platformio/OutputPanel";
import { ProblemsPanel } from "@/components/problems/ProblemsPanel";
import { CameraPanel } from "@/components/camera/CameraPanel";
import { SerialMonitor } from "@/components/serial/SerialMonitor";
import { SerialPlotter } from "@/components/serial/SerialPlotter";
import { TerminalView } from "@/components/terminal/TerminalView";
import { useI18n } from "@/hooks/useI18n";
import { useLayoutStore } from "@/stores/layoutStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { BOTTOM_PANEL_TABS, type BottomPanelTab } from "@/types/layout";
import { cn } from "@/lib/cn";

const ARDUINO_PRIMARY: ReadonlySet<BottomPanelTab> = new Set([
  "serial",
  "output",
]);

function orderedTabs(arduinoMode: boolean) {
  if (!arduinoMode) return [...BOTTOM_PANEL_TABS];
  const primary = BOTTOM_PANEL_TABS.filter((t) => ARDUINO_PRIMARY.has(t.id));
  const rest = BOTTOM_PANEL_TABS.filter((t) => !ARDUINO_PRIMARY.has(t.id));
  return [...primary, ...rest];
}

export function BottomPanel() {
  const { t } = useI18n();
  const visible = useLayoutStore((s) => s.bottomPanelVisible);
  const height = useLayoutStore((s) => s.bottomPanelHeight);
  const activeTab = useLayoutStore((s) => s.bottomPanelTab);
  const setBottomPanelTab = useLayoutStore((s) => s.setBottomPanelTab);
  const setBottomPanelVisible = useLayoutStore((s) => s.setBottomPanelVisible);
  const toggleBottomPanel = useLayoutStore((s) => s.toggleBottomPanel);
  const arduinoMode = useSettingsStore((s) => s.arduinoMode);
  const tabs = orderedTabs(arduinoMode);

  // Keep heavy panels mounted after first visit so PTY/serial sessions survive tab switches
  // and panel collapse (hidden ≠ unmounted).
  const [visited, setVisited] = useState<Record<string, boolean>>({
    [activeTab]: true,
  });

  const visit = (tab: BottomPanelTab) => {
    setVisited((prev) => (prev[tab] ? prev : { ...prev, [tab]: true }));
    setBottomPanelTab(tab);
  };

  const terminalActive = visible && activeTab === "terminal";

  return (
    <>
      {!visible && (
        <div className="flex h-8 shrink-0 items-center border-t border-aether-border bg-aether-surface px-2">
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => visit(tab.id)}
                className={cn(
                  "px-2 py-1 text-[11px] uppercase tracking-wide transition-colors hover:text-aether-fg",
                  arduinoMode && ARDUINO_PRIMARY.has(tab.id)
                    ? "font-semibold text-aether-fg-muted"
                    : "text-aether-fg-dim",
                )}
              >
                {t(tab.labelKey)}
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
      )}

      <section
        className={cn(
          "flex shrink-0 flex-col bg-aether-surface",
          !visible && "hidden",
        )}
        style={visible ? { height } : undefined}
        aria-label="Bottom Panel"
        aria-hidden={!visible}
      >
        <header className="flex h-8 shrink-0 items-center border-b border-aether-border px-2">
          <div className="flex items-center gap-0.5" role="tablist">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const primary =
                arduinoMode && ARDUINO_PRIMARY.has(tab.id);
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
                      : primary
                        ? "font-semibold text-aether-fg-muted hover:text-aether-fg"
                        : "text-aether-fg-dim hover:text-aether-fg-muted",
                  )}
                >
                  {t(tab.labelKey)}
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
                visible && activeTab === "problems" ? "z-10" : "hidden",
              )}
              aria-hidden={!visible || activeTab !== "problems"}
            >
              <ProblemsPanel />
            </div>
          )}

          {visited.output && (
            <div
              className={cn(
                "absolute inset-0",
                visible && activeTab === "output" ? "z-10" : "hidden",
              )}
              aria-hidden={!visible || activeTab !== "output"}
            >
              <OutputPanel />
            </div>
          )}

          {visited.serial && (
            <div
              className={cn(
                "absolute inset-0",
                visible && activeTab === "serial" ? "z-10" : "hidden",
              )}
              aria-hidden={!visible || activeTab !== "serial"}
            >
              <SerialMonitor />
            </div>
          )}

          {visited.plotter && (
            <div
              className={cn(
                "absolute inset-0",
                visible && activeTab === "plotter" ? "z-10" : "hidden",
              )}
              aria-hidden={!visible || activeTab !== "plotter"}
            >
              <SerialPlotter />
            </div>
          )}

          {visited.camera && (
            <div
              className={cn(
                "absolute inset-0",
                visible && activeTab === "camera" ? "z-10" : "hidden",
              )}
              aria-hidden={!visible || activeTab !== "camera"}
            >
              <CameraPanel />
            </div>
          )}

          {visited.debug && (
            <div
              className={cn(
                "absolute inset-0",
                visible && activeTab === "debug" ? "z-10" : "hidden",
              )}
              aria-hidden={!visible || activeTab !== "debug"}
            >
              <DebugConsole />
            </div>
          )}

          {visited.terminal && (
            <div
              className={cn(
                "absolute inset-0",
                visible && activeTab === "terminal" ? "z-10" : "hidden",
              )}
              aria-hidden={!terminalActive}
            >
              <TerminalView active={terminalActive} />
            </div>
          )}

          {visible &&
            activeTab !== "serial" &&
            activeTab !== "plotter" &&
            activeTab !== "camera" &&
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
    </>
  );
}
