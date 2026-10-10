import { useEffect, useRef, useState } from "react";
import { ChartLine, Eraser, Plug, PlugZap, RefreshCw, Send } from "lucide-react";
import { ComDriversHelp } from "@/components/serial/ComDriversHelp";
import { useI18n } from "@/hooks/useI18n";
import { BAUD_RATES } from "@/lib/serial";
import { isTauriRuntime } from "@/lib/tauri";
import { cn } from "@/lib/cn";
import { useLayoutStore } from "@/stores/layoutStore";
import { useSerialStore } from "@/stores/serialStore";

export function SerialMonitor() {
  const { t } = useI18n();
  const tauri = isTauriRuntime();
  const [input, setInput] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const setBottomPanelTab = useLayoutStore((s) => s.setBottomPanelTab);

  const ports = useSerialStore((s) => s.ports);
  const selectedPath = useSerialStore((s) => s.selectedPath);
  const baudRate = useSerialStore((s) => s.baudRate);
  const connected = useSerialStore((s) => s.connected);
  const connecting = useSerialStore((s) => s.connecting);
  const lines = useSerialStore((s) => s.lines);
  const autoScroll = useSerialStore((s) => s.autoScroll);
  const error = useSerialStore((s) => s.error);
  const refreshPorts = useSerialStore((s) => s.refreshPorts);
  const setSelectedPath = useSerialStore((s) => s.setSelectedPath);
  const setBaudRate = useSerialStore((s) => s.setBaudRate);
  const setAutoScroll = useSerialStore((s) => s.setAutoScroll);
  const connect = useSerialStore((s) => s.connect);
  const disconnect = useSerialStore((s) => s.disconnect);
  const send = useSerialStore((s) => s.send);
  const clearLines = useSerialStore((s) => s.clearLines);

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
        Serial Monitor needs the desktop app.
        <span className="mt-1 font-mono text-aether-fg-muted">
          npm run tauri:dev
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-aether-border px-2 py-1.5">
        <select
          value={selectedPath}
          disabled={connected || connecting}
          onChange={(event) => setSelectedPath(event.target.value)}
          className="h-7 min-w-[140px] max-w-[220px] rounded border border-aether-border bg-aether-bg px-1.5 text-[11px] text-aether-fg outline-none focus:border-aether-accent"
          aria-label="Serial port"
        >
          {ports.length === 0 ? (
            <option value="">No ports found</option>
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
          aria-label="Baud rate"
        >
          {BAUD_RATES.map((rate) => (
            <option key={rate} value={rate}>
              {rate}
            </option>
          ))}
        </select>

        <button
          type="button"
          title="Refresh ports"
          aria-label="Refresh ports"
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
            onClick={() => {
              void disconnect();
            }}
            className="flex h-7 items-center gap-1 rounded border border-aether-border px-2 text-[11px] text-aether-fg hover:bg-aether-surface-raised"
          >
            <PlugZap size={13} />
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            disabled={!selectedPath || connecting}
            onClick={() => {
              void connect();
            }}
            className="flex h-7 items-center gap-1 rounded border border-aether-border bg-aether-accent-muted px-2 text-[11px] text-aether-fg hover:bg-aether-accent/30 disabled:opacity-40"
          >
            <Plug size={13} />
            {connecting ? "Connecting…" : "Connect"}
          </button>
        )}

        <button
          type="button"
          title="Clear output"
          aria-label="Clear output"
          onClick={clearLines}
          className="flex h-7 w-7 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
        >
          <Eraser size={13} />
        </button>

        <button
          type="button"
          title={t("panel.plotter")}
          aria-label={t("panel.plotter")}
          onClick={() => setBottomPanelTab("plotter")}
          className="flex h-7 items-center gap-1 rounded border border-aether-border px-2 text-[11px] text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
        >
          <ChartLine size={13} />
          {t("panel.plotter")}
        </button>

        <label className="ml-auto flex items-center gap-1 text-[11px] text-aether-fg-muted">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(event) => setAutoScroll(event.target.checked)}
            className="accent-aether-accent"
          />
          Autoscroll
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
          <p className="text-aether-fg-dim">
            {connected
              ? "Connected. Waiting for data…"
              : "Select a port and connect to start the Serial Monitor."}
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
          placeholder={connected ? "Send line…" : "Connect to send"}
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
          Send
        </button>
      </form>
    </div>
  );
}
