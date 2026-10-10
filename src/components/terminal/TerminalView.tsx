import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { RotateCcw } from "lucide-react";
import {
  applyXtermStdinEnabled,
  terminalFocusOptions,
} from "@/lib/focusPolicy";
import {
  canUseNativeTerminal,
  closeTerminal,
  createTerminal,
  listenTerminalData,
  listenTerminalExit,
  resizeTerminal,
  writeTerminal,
} from "@/lib/terminal";
import { useWorkspaceStore } from "@/stores/workspaceStore";

interface TerminalViewProps {
  /** When false, keep session alive but skip fit churn / stdin. */
  active?: boolean;
}

export function TerminalView({ active = true }: TerminalViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const idRef = useRef<number | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const rootPath = useWorkspaceStore((s) => s.rootPath);

  useEffect(() => {
    if (!canUseNativeTerminal()) {
      setError("Terminal requires the desktop app (npm run tauri:dev).");
      return;
    }

    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let unlistenData: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;
    let resizeObserver: ResizeObserver | undefined;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily:
        '"Cascadia Code", "JetBrains Mono", "Fira Code", Consolas, monospace',
      theme: {
        background: "#1e1e1e",
        foreground: "#cccccc",
        cursor: "#aeafad",
        selectionBackground: "#264f78",
        black: "#1e1e1e",
        red: "#f14c4c",
        green: "#89d185",
        yellow: "#cca700",
        blue: "#3d9eff",
        magenta: "#c586c0",
        cyan: "#4ec9b0",
        white: "#cccccc",
        brightBlack: "#6a6a6a",
        brightRed: "#f14c4c",
        brightGreen: "#89d185",
        brightYellow: "#cca700",
        brightBlue: "#3d9eff",
        brightMagenta: "#c586c0",
        brightCyan: "#4ec9b0",
        brightWhite: "#ffffff",
      },
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    fit.fit();

    // Race-safe: boot may finish while another bottom tab is active / panel hidden.
    if (!activeRef.current) {
      term.blur();
      term.options.disableStdin = terminalFocusOptions(false).disableStdin;
      applyXtermStdinEnabled(host, false);
    }

    termRef.current = term;
    fitRef.current = fit;

    const boot = async () => {
      try {
        const { id } = await createTerminal({
          cols: term.cols,
          rows: term.rows,
          cwd: rootPath,
        });
        if (disposed) {
          await closeTerminal(id);
          return;
        }
        idRef.current = id;
        setReady(true);
        setError(null);

        unlistenData = await listenTerminalData((payload) => {
          if (payload.id === id) {
            term.write(payload.data);
          }
        });

        unlistenExit = await listenTerminalExit((payload) => {
          if (payload.id !== id) return;
          const code = payload.code ?? "?";
          term.writeln(`\r\n\x1b[90m[process exited with code ${code}]\x1b[0m`);
          idRef.current = null;
          setReady(false);
        });

        term.onData((data) => {
          const currentId = idRef.current;
          if (currentId == null) return;
          void writeTerminal(currentId, data).catch((err: unknown) => {
            setError(err instanceof Error ? err.message : "Write failed");
          });
        });

        resizeObserver = new ResizeObserver(() => {
          try {
            fit.fit();
            const currentId = idRef.current;
            if (currentId != null) {
              void resizeTerminal(currentId, term.cols, term.rows);
            }
          } catch {
            // ignore fit races while hidden
          }
        });
        resizeObserver.observe(host);
      } catch (err) {
        if (!disposed) {
          setError(
            err instanceof Error ? err.message : "Failed to start terminal",
          );
          setReady(false);
        }
      }
    };

    void boot();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      unlistenData?.();
      unlistenExit?.();
      const id = idRef.current;
      idRef.current = null;
      if (id != null) {
        void closeTerminal(id);
      }
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [sessionKey, rootPath]);

  useEffect(() => {
    const term = termRef.current;
    const host = hostRef.current;
    if (!term) return;

    // Hidden / inactive terminals must not keep the xterm helper focused —
    // otherwise keystrokes never reach Monaco / Search.
    const policy = terminalFocusOptions(active);
    if (policy.disableStdin) {
      try {
        term.blur();
        term.options.disableStdin = true;
        applyXtermStdinEnabled(host, false);
        const focused = document.activeElement;
        if (focused instanceof HTMLElement && host?.contains(focused)) {
          focused.blur();
        }
      } catch {
        // ignore
      }
      return;
    }

    term.options.disableStdin = false;
    applyXtermStdinEnabled(host, true);
    const timer = window.setTimeout(() => {
      try {
        fitRef.current?.fit();
        const id = idRef.current;
        if (id != null) {
          void resizeTerminal(id, term.cols, term.rows);
        }
      } catch {
        // ignore
      }
    }, 40);
    return () => window.clearTimeout(timer);
  }, [active]);

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-aether-bg"
      data-aether-focus-surface="terminal"
    >
      <div className="flex h-7 shrink-0 items-center justify-between border-b border-aether-border px-2">
        <span className="truncate text-[11px] text-aether-fg-muted">
          {ready ? "PowerShell" : "Terminal"}
          {rootPath ? ` · cwd ${rootPath}` : ""}
        </span>
        <button
          type="button"
          title="Restart terminal"
          aria-label="Restart terminal"
          onClick={() => setSessionKey((value) => value + 1)}
          className="flex h-6 items-center gap-1 rounded px-1.5 text-[11px] text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
        >
          <RotateCcw size={12} />
          Restart
        </button>
      </div>

      {error && (
        <div className="border-b border-aether-border px-3 py-1 text-[11px] text-aether-danger">
          {error}
        </div>
      )}

      <div ref={hostRef} className="min-h-0 flex-1 px-1 py-1" />
    </div>
  );
}
