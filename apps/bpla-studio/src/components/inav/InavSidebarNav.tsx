import { Plane, Plug, PlugZap, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { useI18n } from "@/hooks/useI18n";
import type { MessageKey } from "@/i18n";
import { cn } from "@/lib/cn";
import { INAV_CONFIGURATOR_TABS } from "@/lib/inavTabs";
import { BAUD_RATES } from "@/lib/serial";
import { isTauriRuntime } from "@/lib/tauri";
import { useInavStore } from "@/stores/inavStore";
import { useSerialStore } from "@/stores/serialStore";

/** Betaflight-style left nav: connect + section list. Content lives in the main workspace. */
export function InavSidebarNav() {
  const { t } = useI18n();
  const tauri = isTauriRuntime();

  const ports = useSerialStore((s) => s.ports);
  const selectedPath = useSerialStore((s) => s.selectedPath);
  const baudRate = useSerialStore((s) => s.baudRate);
  const connected = useSerialStore((s) => s.connected);
  const connecting = useSerialStore((s) => s.connecting);
  const refreshPorts = useSerialStore((s) => s.refreshPorts);
  const setSelectedPath = useSerialStore((s) => s.setSelectedPath);
  const setBaudRate = useSerialStore((s) => s.setBaudRate);

  const sessionActive = useInavStore((s) => s.sessionActive);
  const activeTab = useInavStore((s) => s.activeTab);
  const setActiveTab = useInavStore((s) => s.setActiveTab);
  const connectSession = useInavStore((s) => s.connectSession);
  const disconnectSession = useInavStore((s) => s.disconnectSession);
  const snapshot = useInavStore((s) => s.mspSnapshot);
  const error = useInavStore((s) => s.error);

  useEffect(() => {
    if (!tauri) return;
    void refreshPorts();
  }, [tauri, refreshPorts]);

  const live = connected && sessionActive;

  if (!tauri) {
    return (
      <div className="px-3 py-3 text-xs text-aether-fg-dim" data-testid="inav-sidebar-nav">
        <p>{t("inav.desktopRequired")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="inav-sidebar-nav">
      <header className="flex h-9 shrink-0 items-center gap-1.5 px-3">
        <Plane size={12} className="text-aether-accent" />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-aether-fg-muted">
          {t("inav.title")}
        </h2>
      </header>

      <div className="space-y-1.5 border-b border-aether-border px-3 pb-2">
        <p className="text-[10px] leading-snug text-aether-fg-dim">
          {t("inav.connectThroughAether")}
        </p>
        <select
          value={selectedPath}
          disabled={connected || connecting}
          onChange={(e) => setSelectedPath(e.target.value)}
          className="h-7 w-full rounded border border-aether-border bg-aether-bg px-1.5 text-[11px] text-aether-fg outline-none focus:border-aether-accent"
          aria-label={t("inav.port")}
          data-testid="inav-port"
        >
          {ports.length === 0 ? (
            <option value="">{t("inav.noPorts")}</option>
          ) : (
            ports.map((port) => (
              <option key={port.path} value={port.path}>
                {port.path}
              </option>
            ))
          )}
        </select>
        <div className="flex gap-1">
          <select
            value={baudRate}
            disabled={connected || connecting}
            onChange={(e) => setBaudRate(Number(e.target.value))}
            className="h-7 min-w-0 flex-1 rounded border border-aether-border bg-aether-bg px-1 text-[11px] text-aether-fg"
            aria-label={t("inav.baud")}
          >
            {BAUD_RATES.map((rate) => (
              <option key={rate} value={rate}>
                {rate}
              </option>
            ))}
          </select>
          <button
            type="button"
            title={t("common.refresh")}
            onClick={() => void refreshPorts()}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-aether-border text-aether-fg-muted hover:bg-aether-surface-raised"
          >
            <RefreshCw size={12} />
          </button>
        </div>
        {connected ? (
          <button
            type="button"
            data-testid="inav-disconnect"
            onClick={() => void disconnectSession()}
            className="flex h-8 w-full items-center justify-center gap-1 rounded border border-aether-border text-[11px] text-aether-fg hover:bg-aether-surface-raised"
          >
            <Plug size={12} />
            {t("inav.disconnect")}
          </button>
        ) : (
          <button
            type="button"
            data-testid="inav-connect"
            disabled={connecting || !selectedPath}
            onClick={() => void connectSession()}
            className="flex h-8 w-full items-center justify-center gap-1 rounded border border-aether-accent bg-aether-accent-muted text-[11px] font-medium text-aether-fg hover:opacity-90 disabled:opacity-40"
          >
            <PlugZap size={12} />
            {connecting ? t("inav.connecting") : t("inav.connectAether")}
          </button>
        )}
        <p
          className={cn(
            "text-[10px]",
            live ? "text-emerald-400" : "text-aether-fg-dim",
          )}
        >
          {live
            ? t("inav.sessionOnHud", {
                name: snapshot?.name?.trim() || snapshot?.fcVariant || "FC",
              })
            : t("inav.sessionOff")}
        </p>
        {error && <p className="text-[10px] text-aether-danger">{error}</p>}
      </div>

      <nav
        className="aether-scroll flex min-h-0 flex-1 flex-col gap-0.5 overflow-auto px-2 py-2"
        aria-label={t("inav.tabsAria")}
      >
        {INAV_CONFIGURATOR_TABS.map((tab) => {
          const selected = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              data-testid={`inav-nav-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "rounded px-2 py-1.5 text-left text-[11px]",
                selected
                  ? "bg-aether-accent-muted font-medium text-aether-fg"
                  : "text-aether-fg-dim hover:bg-aether-surface-raised hover:text-aether-fg",
              )}
            >
              {t(tab.labelKey as MessageKey)}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
