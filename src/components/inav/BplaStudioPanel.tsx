import { useEffect, useState } from "react";
import { ExternalLink, Plane, PlugZap, RefreshCw } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import {
  BPLA_STUDIO_DOWNLOAD_HINT,
  detectBplaStudio,
  openBplaStudio,
  type BplaStudioInfo,
} from "@/lib/bplaStudio";
import { BAUD_RATES } from "@/lib/serial";
import { isTauriRuntime } from "@/lib/tauri";
import { useInavStore } from "@/stores/inavStore";
import { useSerialStore } from "@/stores/serialStore";
import { useSettingsStore } from "@/stores/settingsStore";

/**
 * Thin Aether bridge: pick COM, release port, launch БПЛА-Студия.
 * Full configurator lives in the separate app — not in the IDE.
 */
export function BplaStudioPanel() {
  const { t } = useI18n();
  const tauri = isTauriRuntime();
  const flash = useSettingsStore((s) => s.flashNotice);
  const [info, setInfo] = useState<BplaStudioInfo | null>(null);
  const [busy, setBusy] = useState(false);

  const ports = useSerialStore((s) => s.ports);
  const selectedPath = useSerialStore((s) => s.selectedPath);
  const baudRate = useSerialStore((s) => s.baudRate);
  const refreshPorts = useSerialStore((s) => s.refreshPorts);
  const setSelectedPath = useSerialStore((s) => s.setSelectedPath);
  const setBaudRate = useSerialStore((s) => s.setBaudRate);
  const releasePort = useInavStore((s) => s.releasePort);

  const refreshDetect = async () => {
    const next = await detectBplaStudio();
    setInfo(next);
  };

  useEffect(() => {
    if (!tauri) return;
    void refreshPorts();
    void refreshDetect();
  }, [tauri, refreshPorts]);

  const onLaunch = async () => {
    if (!tauri) {
      flash(t("studio.bridge.desktopRequired"));
      return;
    }
    setBusy(true);
    try {
      await releasePort();
      await openBplaStudio({
        port: selectedPath || undefined,
        baud: baudRate,
      });
      flash(t("studio.bridge.launched"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("BPLA_STUDIO_MISSING")) {
        flash(t("studio.bridge.missing"));
      } else {
        flash(msg);
      }
    } finally {
      setBusy(false);
      void refreshDetect();
    }
  };

  if (!tauri) {
    return (
      <div className="px-4 py-3 text-xs text-aether-fg-dim" data-testid="bpla-studio-panel">
        <p>{t("studio.bridge.desktopRequired")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="bpla-studio-panel">
      <header className="flex h-9 shrink-0 items-center gap-1.5 px-3">
        <Plane size={12} className="text-aether-accent" />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-aether-fg-muted">
          {t("studio.bridge.title")}
        </h2>
      </header>

      <div className="aether-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-3 pb-4 text-xs">
        <p className="text-[11px] leading-relaxed text-aether-fg-dim">
          {t("studio.bridge.hint")}
        </p>

        <section className="space-y-1.5 rounded border border-aether-border bg-aether-surface-raised/40 p-2">
          <p className="text-[11px] uppercase tracking-wide text-aether-fg-dim">
            {t("studio.bridge.status")}
          </p>
          <p className="font-mono text-[11px] text-aether-fg">
            {info?.installed
              ? t("studio.bridge.installed", { path: info.path ?? "—" })
              : t("studio.bridge.notInstalled")}
          </p>
          {!info?.installed && (
            <p className="text-[10px] text-aether-fg-dim">{BPLA_STUDIO_DOWNLOAD_HINT}</p>
          )}
          <button
            type="button"
            onClick={() => void refreshDetect()}
            className="flex h-7 items-center gap-1 rounded border border-aether-border px-2 text-[11px] text-aether-fg hover:bg-aether-surface-raised"
          >
            <RefreshCw size={12} />
            {t("common.refresh")}
          </button>
        </section>

        <section className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wide text-aether-fg-dim">
            {t("studio.bridge.handoff")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <select
              value={selectedPath}
              onChange={(e) => setSelectedPath(e.target.value)}
              className="h-7 min-w-[120px] flex-1 rounded border border-aether-border bg-aether-bg px-1.5 text-[11px] text-aether-fg"
              aria-label={t("inav.port")}
              data-testid="bpla-studio-port"
            >
              {ports.length === 0 ? (
                <option value="">{t("inav.noPorts")}</option>
              ) : (
                ports.map((p) => (
                  <option key={p.path} value={p.path}>
                    {p.path}
                  </option>
                ))
              )}
            </select>
            <select
              value={baudRate}
              onChange={(e) => setBaudRate(Number(e.target.value))}
              className="h-7 rounded border border-aether-border bg-aether-bg px-1.5 text-[11px] text-aether-fg"
              aria-label={t("inav.baud")}
            >
              {BAUD_RATES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button
              type="button"
              title={t("common.refresh")}
              onClick={() => void refreshPorts()}
              className="flex h-7 w-7 items-center justify-center rounded border border-aether-border text-aether-fg-muted hover:bg-aether-surface-raised"
            >
              <RefreshCw size={12} />
            </button>
          </div>
        </section>

        <button
          type="button"
          data-testid="bpla-studio-open"
          disabled={busy}
          onClick={() => void onLaunch()}
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded border border-aether-accent bg-aether-accent-muted text-[12px] font-medium text-aether-fg disabled:opacity-40"
        >
          {info?.installed ? <PlugZap size={14} /> : <ExternalLink size={14} />}
          {busy ? t("studio.bridge.launching") : t("studio.bridge.open")}
        </button>
      </div>
    </div>
  );
}
