import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ExternalLink,
  Plane,
  Plug,
  PlugZap,
  RefreshCw,
  Send,
  Terminal,
} from "lucide-react";
import { IdeFlashCard } from "@/components/inav/IdeFlashCard";
import { useI18n } from "@/hooks/useI18n";
import {
  AETHER_CONFIGURATOR_HINT,
  detectAetherConfigurator,
  openAetherConfigurator,
  type AetherConfiguratorInfo,
} from "@/lib/aetherConfigurator";
import { cn } from "@/lib/cn";
import { mspSnapshotToPlotSample } from "@/lib/mspPlotter";
import { BAUD_RATES } from "@/lib/serial";
import { isTauriRuntime } from "@/lib/tauri";
import { useInavStore } from "@/stores/inavStore";
import { useLayoutStore } from "@/stores/layoutStore";
import { usePlotterStore } from "@/stores/plotterStore";
import { useSerialStore } from "@/stores/serialStore";
import { useSettingsStore } from "@/stores/settingsStore";

/**
 * BPLA panel: COM → MSP/CLI → DFU → Plotter, plus launch Aether Configurator.
 */
export function BplaStudioPanel() {
  const { t } = useI18n();
  const tauri = isTauriRuntime();
  const flash = useSettingsStore((s) => s.flashNotice);
  const [cfgInfo, setCfgInfo] = useState<AetherConfiguratorInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [cliDraft, setCliDraft] = useState("");
  const [liveTelemetry, setLiveTelemetry] = useState(true);
  const cliEndRef = useRef<HTMLDivElement>(null);

  const ports = useSerialStore((s) => s.ports);
  const selectedPath = useSerialStore((s) => s.selectedPath);
  const baudRate = useSerialStore((s) => s.baudRate);
  const connected = useSerialStore((s) => s.connected);
  const refreshPorts = useSerialStore((s) => s.refreshPorts);
  const setSelectedPath = useSerialStore((s) => s.setSelectedPath);
  const setBaudRate = useSerialStore((s) => s.setBaudRate);
  const sendSerial = useSerialStore((s) => s.send);

  const sessionActive = useInavStore((s) => s.sessionActive);
  const connectSession = useInavStore((s) => s.connectSession);
  const disconnectSession = useInavStore((s) => s.disconnectSession);
  const releasePort = useInavStore((s) => s.releasePort);
  const refreshMspStatus = useInavStore((s) => s.refreshMspStatus);
  const mspSnapshot = useInavStore((s) => s.mspSnapshot);
  const mspPolling = useInavStore((s) => s.mspPolling);
  const mspError = useInavStore((s) => s.mspError);
  const cliLines = useInavStore((s) => s.cliLines);
  const clearCli = useInavStore((s) => s.clearCli);
  const inavError = useInavStore((s) => s.error);

  const setBottomPanelVisible = useLayoutStore((s) => s.setBottomPanelVisible);
  const setBottomPanelTab = useLayoutStore((s) => s.setBottomPanelTab);
  const ingestSample = usePlotterStore((s) => s.ingestSample);

  const live = connected && sessionActive;

  const refreshDetect = async () => {
    setCfgInfo(await detectAetherConfigurator());
  };

  useEffect(() => {
    if (!tauri) return;
    void refreshPorts();
    void refreshDetect();
  }, [tauri, refreshPorts]);

  useEffect(() => {
    cliEndRef.current?.scrollIntoView({ block: "end" });
  }, [cliLines.length]);

  useEffect(() => {
    if (!live || !liveTelemetry) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await refreshMspStatus();
      const snap = useInavStore.getState().mspSnapshot;
      const sample = mspSnapshotToPlotSample(snap);
      if (sample) ingestSample(sample);
    };
    void tick();
    const id = window.setInterval(() => void tick(), 1500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [live, liveTelemetry, refreshMspStatus, ingestSample]);

  const onConnect = async () => {
    if (!selectedPath) {
      flash(t("inav.msp.needConnect"));
      return;
    }
    await connectSession();
  };

  const onSendCli = async () => {
    const cmd = cliDraft.trim();
    if (!cmd || !live) return;
    setCliDraft("");
    await sendSerial(`${cmd}\r`);
  };

  const openPlotter = () => {
    setBottomPanelVisible(true);
    setBottomPanelTab("plotter");
    setLiveTelemetry(true);
  };

  const onLaunchConfigurator = async () => {
    if (!tauri) {
      flash(t("bplaPath.configuratorDesktop"));
      return;
    }
    setBusy(true);
    try {
      await releasePort();
      await openAetherConfigurator({
        port: selectedPath || undefined,
        baud: baudRate,
      });
      flash(t("bplaPath.configuratorLaunched"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("AETHER_CONFIGURATOR_MISSING")) {
        flash(t("bplaPath.configuratorMissing"));
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
      <div
        className="px-4 py-3 text-xs text-aether-fg-dim"
        data-testid="bpla-studio-panel"
      >
        <p>{t("bplaPath.configuratorDesktop")}</p>
      </div>
    );
  }

  const mspErrorText = (() => {
    if (!mspError) return null;
    if (mspError === "MSP_NEED_CONNECT") return t("inav.msp.needConnect");
    if (mspError === "MSP_NO_RESPONSE") return t("inav.msp.noResponse");
    return mspError;
  })();

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="bpla-studio-panel">
      <header className="flex h-9 shrink-0 items-center gap-1.5 px-3">
        <Plane size={12} className="text-aether-accent" />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-aether-fg-muted">
          {t("bplaPath.title")}
        </h2>
      </header>

      <div className="aether-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-3 pb-4 text-xs">
        <p className="text-[11px] leading-relaxed text-aether-fg-dim">
          {t("bplaPath.hint")}
        </p>

        {/* Aether Configurator */}
        <section
          className="space-y-1.5 rounded border border-aether-accent/40 bg-aether-accent-muted/30 p-2"
          data-testid="bpla-path-configurator"
        >
          <p className="text-[11px] font-medium text-aether-fg">
            {t("bplaPath.configuratorTitle")}
          </p>
          <p className="text-[10px] leading-relaxed text-aether-fg-dim">
            {t("bplaPath.configuratorHint")}
          </p>
          <p className="font-mono text-[10px] text-aether-fg-muted">
            {cfgInfo?.installed
              ? t("bplaPath.configuratorInstalled", {
                  path: cfgInfo.path ?? "—",
                })
              : t("bplaPath.configuratorMissing")}
          </p>
          {!cfgInfo?.installed && (
            <p className="text-[10px] text-aether-fg-dim">
              {AETHER_CONFIGURATOR_HINT}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            <select
              value={selectedPath}
              onChange={(e) => setSelectedPath(e.target.value)}
              className="h-7 min-w-[100px] flex-1 rounded border border-aether-border bg-aether-bg px-1.5 text-[11px] text-aether-fg"
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
              onClick={() => {
                void refreshPorts();
                void refreshDetect();
              }}
              className="flex h-7 w-7 items-center justify-center rounded border border-aether-border text-aether-fg-muted hover:bg-aether-surface-raised"
            >
              <RefreshCw size={12} />
            </button>
          </div>
          <button
            type="button"
            data-testid="bpla-configurator-open"
            disabled={busy}
            onClick={() => void onLaunchConfigurator()}
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded border border-aether-accent bg-aether-accent-muted text-[12px] font-medium text-aether-fg disabled:opacity-40"
          >
            {cfgInfo?.installed ? (
              <PlugZap size={14} />
            ) : (
              <ExternalLink size={14} />
            )}
            {busy
              ? t("bplaPath.configuratorLaunching")
              : t("bplaPath.configuratorOpen")}
          </button>
        </section>

        {/* 1. COM session in IDE */}
        <section
          className="space-y-1.5 rounded border border-aether-border bg-aether-surface-raised/40 p-2"
          data-testid="bpla-path-com"
        >
          <p className="text-[11px] uppercase tracking-wide text-aether-fg-dim">
            {t("bplaPath.step.com")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {!live ? (
              <button
                type="button"
                data-testid="bpla-path-connect"
                onClick={() => void onConnect()}
                className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded border border-aether-border text-[12px] text-aether-fg hover:bg-aether-surface-raised"
              >
                <Plug size={14} />
                {t("inav.connect")}
              </button>
            ) : (
              <button
                type="button"
                data-testid="bpla-path-disconnect"
                onClick={() => void disconnectSession()}
                className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded border border-aether-border text-[12px] text-aether-fg hover:bg-aether-surface-raised"
              >
                <PlugZap size={14} />
                {t("inav.disconnect")}
              </button>
            )}
          </div>
          <p
            className={cn(
              "text-[10px]",
              live ? "text-emerald-400" : "text-aether-fg-dim",
            )}
          >
            {live ? t("inav.sessionOn") : t("inav.sessionOff")}
          </p>
          {inavError && (
            <p className="text-[11px] text-aether-danger">{inavError}</p>
          )}
        </section>

        {/* 2. MSP */}
        <section
          className="space-y-1.5 rounded border border-aether-border bg-aether-surface-raised/40 p-2"
          data-testid="bpla-path-msp"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-wide text-aether-fg-dim">
              {t("bplaPath.step.msp")}
            </p>
            <button
              type="button"
              data-testid="bpla-path-msp-refresh"
              disabled={!live || mspPolling}
              onClick={() => void refreshMspStatus()}
              className="flex h-7 items-center gap-1 rounded border border-aether-border px-2 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
            >
              <RefreshCw
                size={12}
                className={cn(mspPolling && "animate-spin")}
              />
              {mspPolling ? t("inav.msp.refreshing") : t("inav.msp.refresh")}
            </button>
          </div>
          {mspErrorText && (
            <p className="text-[11px] text-aether-danger">{mspErrorText}</p>
          )}
          {mspSnapshot ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px]">
              <dt className="text-aether-fg-dim">{t("inav.msp.fcVariant")}</dt>
              <dd className="font-mono text-aether-fg">
                {mspSnapshot.fcVariant ?? "—"}
              </dd>
              <dt className="text-aether-fg-dim">{t("inav.msp.voltage")}</dt>
              <dd className="font-mono text-aether-fg">
                {mspSnapshot.analog
                  ? t("inav.msp.voltageValue", {
                      v: mspSnapshot.analog.voltage.toFixed(1),
                    })
                  : "—"}
              </dd>
              <dt className="text-aether-fg-dim">{t("inav.msp.rssi")}</dt>
              <dd
                className="font-mono text-aether-fg"
                data-testid="bpla-path-rssi"
              >
                {mspSnapshot.analog != null
                  ? String(mspSnapshot.analog.rssi)
                  : "—"}
              </dd>
              <dt className="text-aether-fg-dim">{t("inav.msp.armed")}</dt>
              <dd className="font-mono text-aether-fg">
                {mspSnapshot.status
                  ? mspSnapshot.status.armed
                    ? t("inav.msp.armedYes")
                    : t("inav.msp.armedNo")
                  : "—"}
              </dd>
            </dl>
          ) : (
            <p className="text-[11px] text-aether-fg-dim">{t("inav.msp.empty")}</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              data-testid="bpla-path-plotter"
              onClick={openPlotter}
              className="inline-flex items-center gap-1 rounded border border-aether-accent/60 px-2 py-1 text-[11px] text-aether-fg hover:bg-aether-surface-raised"
            >
              <Activity size={11} />
              {t("bplaPath.openPlotter")}
            </button>
            <label className="inline-flex items-center gap-1 text-[11px] text-aether-fg-muted">
              <input
                type="checkbox"
                checked={liveTelemetry}
                onChange={(e) => setLiveTelemetry(e.target.checked)}
              />
              {t("bplaPath.liveTelemetry")}
            </label>
          </div>
        </section>

        {/* 3. CLI */}
        <section
          className="space-y-1.5 rounded border border-aether-border bg-aether-surface-raised/40 p-2"
          data-testid="bpla-path-cli"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-aether-fg-dim">
              <Terminal size={11} />
              {t("bplaPath.step.cli")}
            </p>
            <button
              type="button"
              onClick={() => clearCli()}
              className="text-[10px] text-aether-fg-dim hover:text-aether-fg"
            >
              {t("inav.clear")}
            </button>
          </div>
          <div className="aether-scroll max-h-36 overflow-auto rounded border border-aether-border bg-aether-bg p-1.5 font-mono text-[10px] text-aether-fg-muted">
            {cliLines.length === 0 ? (
              <p>{t("inav.cliEmpty")}</p>
            ) : (
              cliLines.slice(-80).map((line, i) => (
                <div key={`${i}-${line.slice(0, 12)}`}>{line}</div>
              ))
            )}
            <div ref={cliEndRef} />
          </div>
          <div className="flex gap-1">
            <input
              value={cliDraft}
              onChange={(e) => setCliDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void onSendCli();
                }
              }}
              disabled={!live}
              placeholder={t("inav.cliPlaceholder")}
              className="h-7 min-w-0 flex-1 rounded border border-aether-border bg-aether-bg px-2 text-[11px] text-aether-fg disabled:opacity-40"
              data-testid="bpla-path-cli-input"
            />
            <button
              type="button"
              disabled={!live || !cliDraft.trim()}
              onClick={() => void onSendCli()}
              className="flex h-7 w-7 items-center justify-center rounded border border-aether-border text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
            >
              <Send size={12} />
            </button>
          </div>
        </section>

        {/* 4. Flash */}
        <div data-testid="bpla-path-flash">
          <p className="mb-1 text-[11px] uppercase tracking-wide text-aether-fg-dim">
            {t("bplaPath.step.flash")}
          </p>
          <IdeFlashCard />
        </div>
      </div>
    </div>
  );
}
