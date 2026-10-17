import { useEffect, useRef, useState } from "react";
import {
  ChartLine,
  Circle,
  Eraser,
  Plug,
  PlugZap,
  RefreshCw,
  Send,
  Square,
} from "lucide-react";
import { PanelHint } from "@/components/hints/PanelHint";
import { ComDriversHelp } from "@/components/serial/ComDriversHelp";
import { useI18n } from "@/hooks/useI18n";
import { serialEmptyReason } from "@/lib/plotterEmptyState";
import { BAUD_RATES } from "@/lib/serial";
import { isTauriRuntime } from "@/lib/tauri";
import { cn } from "@/lib/cn";
import { useLayoutStore } from "@/stores/layoutStore";
import { useSerialStore } from "@/stores/serialStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { documentDir, join } from "@tauri-apps/api/path";
import { save } from "@tauri-apps/plugin-dialog";
import { mkdir, writeTextFile } from "@tauri-apps/plugin-fs";

export function SerialMonitor() {
  const { t, locale } = useI18n();
  const tauri = isTauriRuntime();
  const [input, setInput] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const setBottomPanelTab = useLayoutStore((s) => s.setBottomPanelTab);
  const flashNotice = useSettingsStore((s) => s.flashNotice);

  const ports = useSerialStore((s) => s.ports);
  const selectedPath = useSerialStore((s) => s.selectedPath);
  const baudRate = useSerialStore((s) => s.baudRate);
  const connected = useSerialStore((s) => s.connected);
  const connecting = useSerialStore((s) => s.connecting);
  const lines = useSerialStore((s) => s.lines);
  const autoScroll = useSerialStore((s) => s.autoScroll);
  const error = useSerialStore((s) => s.error);
  const recording = useSerialStore((s) => s.recording);
  const refreshPorts = useSerialStore((s) => s.refreshPorts);
  const setSelectedPath = useSerialStore((s) => s.setSelectedPath);
  const setBaudRate = useSerialStore((s) => s.setBaudRate);
  const setAutoScroll = useSerialStore((s) => s.setAutoScroll);
  const connect = useSerialStore((s) => s.connect);
  const disconnect = useSerialStore((s) => s.disconnect);
  const send = useSerialStore((s) => s.send);
  const clearLines = useSerialStore((s) => s.clearLines);
  const startRecording = useSerialStore((s) => s.startRecording);
  const stopRecording = useSerialStore((s) => s.stopRecording);

  const emptyReason = serialEmptyReason({
    connected,
    portsEmpty: ports.length === 0,
    hasLines: lines.length > 0,
  });
  const emptyMessage =
    emptyReason === "no_ports"
      ? t("serial.why.noPorts")
      : emptyReason === "need_connect"
        ? t("serial.why.needConnect")
        : emptyReason === "waiting_data"
          ? t("serial.why.waitingData")
          : null;

  const toggleRecord = async () => {
    if (!recording) {
      startRecording();
      flashNotice(t("serial.recordingOn"), 2500);
      return;
    }
    const recorded = stopRecording();
    if (recorded.length === 0) {
      flashNotice(t("serial.recordEmpty"));
      return;
    }
    if (!tauri) {
      flashNotice(t("serial.needDesktop"));
      return;
    }
    try {
      const docs = await documentDir();
      const dir = await join(docs, "Aether", "serial");
      await mkdir(dir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const suggested = await join(dir, `serial-${stamp}.log`);
      const chosen = await save({
        title: locale === "ru" ? "Сохранить лог Serial" : "Save serial log",
        defaultPath: suggested,
        filters: [
          { name: "Log", extensions: ["log", "txt"] },
          { name: "All", extensions: ["*"] },
        ],
      });
      if (typeof chosen !== "string" || !chosen) return;
      await writeTextFile(chosen, recorded.join("\n"));
      flashNotice(t("serial.recorded", { count: recorded.length }), 3500);
    } catch (e) {
      flashNotice(
        e instanceof Error ? e.message : t("serial.recordFailed"),
      );
    }
  };

  useEffect(() => {
    if (!tauri) return;
    void refreshPorts();
  }, [tauri, refreshPorts]);

  useEffect(() => {
    if (!autoScroll || !logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [lines, autoScroll]);

  const onSubmit = () => {
    const value = input;
    if (!value.trim() && value.length === 0) return;
    void send(value);
    setInput("");
  };

  if (!tauri) {
    return (
      <div className="flex h-full flex-col justify-center px-3 text-xs text-aether-fg-dim">
        {t("serial.needDesktop")}
        <span className="mt-1 font-mono text-aether-fg-muted">
          npm run tauri:dev
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHint messageKey="hints.panel.serial" className="mx-2 mt-1.5" />
      <div className="flex flex-wrap items-center gap-1.5 border-b border-aether-border px-2 py-1.5">
        <select
          value={selectedPath}
          disabled={connected || connecting}
          onChange={(event) => setSelectedPath(event.target.value)}
          className="h-7 min-w-[140px] max-w-[220px] rounded border border-aether-border bg-aether-bg px-1.5 text-[11px] text-aether-fg outline-none focus:border-aether-accent"
          aria-label={t("serial.port")}
          title={t("serial.portTitle")}
        >
          {ports.length === 0 ? (
            <option value="">{t("serial.noPorts")}</option>
          ) : (
            ports.map((port) => (
              <option key={port.path} value={port.path}>
                {port.path}
                {port.portType ? ` — ${port.portType}` : ""}
              </option>
            ))
          )}
        </select>

        <select
          value={baudRate}
          disabled={connected || connecting}
          onChange={(event) => setBaudRate(Number(event.target.value))}
          className="h-7 rounded border border-aether-border bg-aether-bg px-1.5 text-[11px] text-aether-fg outline-none focus:border-aether-accent"
          aria-label={t("serial.baud")}
          title={t("serial.baudTitle")}
        >
          {BAUD_RATES.map((rate) => (
            <option key={rate} value={rate}>
              {rate}
            </option>
          ))}
        </select>

        <button
          type="button"
          title={t("serial.refreshTitle")}
          aria-label={t("serial.refresh")}
          onClick={() => {
            void refreshPorts();
          }}
          className="flex h-7 w-7 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
        >
          <RefreshCw size={13} />
        </button>

        {connected ? (
          <button
            type="button"
            title={t("serial.disconnectTitle")}
            aria-label={t("serial.disconnect")}
            onClick={() => {
              void disconnect();
            }}
            className="flex h-7 items-center gap-1 rounded border border-aether-border px-2 text-[11px] text-aether-fg hover:bg-aether-surface-raised"
          >
            <PlugZap size={13} />
            {t("serial.disconnect")}
          </button>
        ) : (
          <button
            type="button"
            title={t("serial.connectTitle")}
            aria-label={t("serial.connect")}
            disabled={!selectedPath || connecting}
            onClick={() => {
              void connect();
            }}
            className="flex h-7 items-center gap-1 rounded border border-aether-border bg-aether-accent-muted px-2 text-[11px] text-aether-fg hover:bg-aether-accent/30 disabled:opacity-40"
          >
            <Plug size={13} />
            {connecting ? t("serial.connecting") : t("serial.connect")}
          </button>
        )}

        <button
          type="button"
          title={t("serial.clearTitle")}
          aria-label={t("serial.clear")}
          onClick={clearLines}
          className="flex h-7 w-7 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
        >
          <Eraser size={13} />
        </button>

        <button
          type="button"
          title={
            recording ? t("serial.recordStopTitle") : t("serial.recordTitle")
          }
          aria-label={recording ? t("serial.recordStop") : t("serial.record")}
          aria-pressed={recording}
          data-testid="serial-record"
          onClick={() => void toggleRecord()}
          className={cn(
            "flex h-7 items-center gap-1 rounded border px-2 text-[11px]",
            recording
              ? "border-aether-danger/50 bg-aether-danger/15 text-aether-fg"
              : "border-aether-border text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg",
          )}
        >
          {recording ? <Square size={12} /> : <Circle size={12} />}
          {recording ? t("serial.recordStop") : t("serial.record")}
        </button>

        <button
          type="button"
          title={t("serial.plotterTitle")}
          aria-label={t("panel.plotter")}
          onClick={() => setBottomPanelTab("plotter")}
          className="flex h-7 items-center gap-1 rounded border border-aether-border px-2 text-[11px] text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
        >
          <ChartLine size={13} />
          {t("panel.plotter")}
        </button>

        <label
          className="ml-auto flex items-center gap-1 text-[11px] text-aether-fg-muted"
          title={t("serial.autoscrollTitle")}
        >
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(event) => setAutoScroll(event.target.checked)}
            className="accent-aether-accent"
          />
          {t("serial.autoscroll")}
        </label>
      </div>

      {(ports.length === 0 || error) && (
        <ComDriversHelp
          compact
          portsEmpty={ports.length === 0}
          error={error}
        />
      )}

      <div
        ref={logRef}
        className="aether-scroll min-h-0 flex-1 overflow-auto px-3 py-2 font-mono text-[11px] leading-5 text-aether-fg"
        role="log"
        aria-live="polite"
      >
        {lines.length === 0 ? (
          <p className="whitespace-pre-wrap text-aether-fg-dim">
            {emptyMessage ?? t("serial.why.needConnect")}
          </p>
        ) : (
          lines.map((line, index) => (
            <div key={`${index}-${line.slice(0, 12)}`} className="whitespace-pre-wrap break-all">
              {line}
            </div>
          ))
        )}
      </div>

      {error && (
        <div className="border-t border-aether-border px-3 py-1 text-[11px] text-aether-danger">
          {error}
        </div>
      )}

      <form
        className="flex items-center gap-1 border-t border-aether-border px-2 py-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={!connected}
          placeholder={
            connected ? t("serial.sendPlaceholder") : t("serial.sendNeedConnect")
          }
          className={cn(
            "h-7 min-w-0 flex-1 rounded border border-aether-border bg-aether-bg px-2 font-mono text-[11px] text-aether-fg outline-none",
            "focus:border-aether-accent disabled:opacity-40",
          )}
        />
        <button
          type="submit"
          disabled={!connected}
          className="flex h-7 items-center gap-1 rounded border border-aether-border px-2 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
        >
          <Send size={13} />
          {t("serial.send")}
        </button>
      </form>
    </div>
  );
}
