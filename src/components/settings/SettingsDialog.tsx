import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { isTauriRuntime } from "@/lib/tauri";
import { useAgentStore } from "@/stores/agentStore";
import {
  useSettingsStore,
  type SettingsTabId,
  type WordWrapSetting,
} from "@/stores/settingsStore";
import { useUpdaterStore } from "@/stores/updaterStore";

type SettingsTab = SettingsTabId;

export function SettingsDialog() {
  const open = useSettingsStore((s) => s.settingsOpen);
  const closeSettings = useSettingsStore((s) => s.closeSettings);
  const consumeInitialTab = useSettingsStore((s) => s.consumeInitialTab);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const tabSize = useSettingsStore((s) => s.tabSize);
  const minimap = useSettingsStore((s) => s.minimap);
  const wordWrap = useSettingsStore((s) => s.wordWrap);
  const fontLigatures = useSettingsStore((s) => s.fontLigatures);
  const lineNumbers = useSettingsStore((s) => s.lineNumbers);
  const renderWhitespace = useSettingsStore((s) => s.renderWhitespace);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const setTabSize = useSettingsStore((s) => s.setTabSize);
  const setMinimap = useSettingsStore((s) => s.setMinimap);
  const setWordWrap = useSettingsStore((s) => s.setWordWrap);
  const setFontLigatures = useSettingsStore((s) => s.setFontLigatures);
  const setLineNumbers = useSettingsStore((s) => s.setLineNumbers);
  const setRenderWhitespace = useSettingsStore((s) => s.setRenderWhitespace);
  const resetEditorDefaults = useSettingsStore((s) => s.resetEditorDefaults);

  const baseUrl = useAgentStore((s) => s.baseUrl);
  const apiKey = useAgentStore((s) => s.apiKey);
  const model = useAgentStore((s) => s.model);
  const includeActiveFile = useAgentStore((s) => s.includeActiveFile);
  const includeProblems = useAgentStore((s) => s.includeProblems);
  const setBaseUrl = useAgentStore((s) => s.setBaseUrl);
  const setApiKey = useAgentStore((s) => s.setApiKey);
  const setModel = useAgentStore((s) => s.setModel);
  const setIncludeActiveFile = useAgentStore((s) => s.setIncludeActiveFile);
  const setIncludeProblems = useAgentStore((s) => s.setIncludeProblems);

  const [tab, setTab] = useState<SettingsTab>("editor");
  const [appVersion, setAppVersion] = useState<string>("0.1.0");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const initial = consumeInitialTab();
    if (initial) setTab(initial);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeSettings();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, closeSettings, consumeInitialTab]);

  useEffect(() => {
    if (!open || !isTauriRuntime()) return;
    void import("@tauri-apps/api/app").then(({ getVersion }) =>
      getVersion()
        .then(setAppVersion)
        .catch(() => undefined),
    );
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[12vh]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeSettings();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded border border-aether-border bg-aether-surface shadow-2xl"
      >
        <header className="flex h-10 shrink-0 items-center justify-between border-b border-aether-border px-3">
          <h2 className="text-sm font-medium text-aether-fg">Settings</h2>
          <button
            type="button"
            title="Close"
            aria-label="Close settings"
            onClick={closeSettings}
            className="flex h-7 w-7 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          <nav className="flex w-36 shrink-0 flex-col gap-0.5 border-r border-aether-border p-2">
            {(
              [
                ["editor", "Editor"],
                ["agent", "AI Agent"],
                ["about", "About"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "rounded px-2 py-1.5 text-left text-xs",
                  tab === id
                    ? "bg-aether-accent-muted text-aether-fg"
                    : "text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg",
                )}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="aether-scroll min-h-0 flex-1 space-y-3 overflow-auto p-4 text-xs">
            {tab === "editor" && (
              <>
                <label className="flex items-center justify-between gap-3">
                  <span className="text-aether-fg">Font size</span>
                  <input
                    type="number"
                    min={10}
                    max={28}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-20 rounded border border-aether-border bg-aether-bg px-2 py-1 text-aether-fg outline-none focus:border-aether-accent"
                  />
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span className="text-aether-fg">Tab size</span>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={tabSize}
                    onChange={(e) => setTabSize(Number(e.target.value))}
                    className="w-20 rounded border border-aether-border bg-aether-bg px-2 py-1 text-aether-fg outline-none focus:border-aether-accent"
                  />
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span className="text-aether-fg">Word wrap</span>
                  <select
                    value={wordWrap}
                    onChange={(e) =>
                      setWordWrap(e.target.value as WordWrapSetting)
                    }
                    className="rounded border border-aether-border bg-aether-bg px-2 py-1 text-aether-fg outline-none focus:border-aether-accent"
                  >
                    <option value="off">Off</option>
                    <option value="on">On</option>
                    <option value="wordWrapColumn">Column</option>
                  </select>
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span className="text-aether-fg">Render whitespace</span>
                  <select
                    value={renderWhitespace}
                    onChange={(e) =>
                      setRenderWhitespace(
                        e.target.value as "none" | "selection" | "all",
                      )
                    }
                    className="rounded border border-aether-border bg-aether-bg px-2 py-1 text-aether-fg outline-none focus:border-aether-accent"
                  >
                    <option value="none">None</option>
                    <option value="selection">Selection</option>
                    <option value="all">All</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-aether-fg">
                  <input
                    type="checkbox"
                    checked={minimap}
                    onChange={(e) => setMinimap(e.target.checked)}
                  />
                  Minimap
                </label>
                <label className="flex items-center gap-2 text-aether-fg">
                  <input
                    type="checkbox"
                    checked={fontLigatures}
                    onChange={(e) => setFontLigatures(e.target.checked)}
                  />
                  Font ligatures
                </label>
                <label className="flex items-center gap-2 text-aether-fg">
                  <input
                    type="checkbox"
                    checked={lineNumbers}
                    onChange={(e) => setLineNumbers(e.target.checked)}
                  />
                  Line numbers
                </label>
                <button
                  type="button"
                  onClick={resetEditorDefaults}
                  className="rounded border border-aether-border px-2 py-1.5 text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
                >
                  Reset editor defaults
                </button>
                <p className="text-[11px] text-aether-fg-dim">
                  Find in file: <kbd className="text-aether-fg">Ctrl+F</kbd> ·
                  Replace: <kbd className="text-aether-fg">Ctrl+H</kbd>
                </p>
              </>
            )}

            {tab === "agent" && (
              <>
                <label className="block">
                  <span className="text-aether-fg-dim">Base URL</span>
                  <input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className="mt-0.5 w-full rounded border border-aether-border bg-aether-bg px-2 py-1.5 text-aether-fg outline-none focus:border-aether-accent"
                  />
                </label>
                <label className="block">
                  <span className="text-aether-fg-dim">API key</span>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="mt-0.5 w-full rounded border border-aether-border bg-aether-bg px-2 py-1.5 text-aether-fg outline-none focus:border-aether-accent"
                    autoComplete="off"
                  />
                </label>
                <label className="block">
                  <span className="text-aether-fg-dim">Model</span>
                  <input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="mt-0.5 w-full rounded border border-aether-border bg-aether-bg px-2 py-1.5 text-aether-fg outline-none focus:border-aether-accent"
                  />
                </label>
                <label className="flex items-center gap-2 text-aether-fg">
                  <input
                    type="checkbox"
                    checked={includeActiveFile}
                    onChange={(e) => setIncludeActiveFile(e.target.checked)}
                  />
                  Attach active file by default
                </label>
                <label className="flex items-center gap-2 text-aether-fg">
                  <input
                    type="checkbox"
                    checked={includeProblems}
                    onChange={(e) => setIncludeProblems(e.target.checked)}
                  />
                  Attach Problems by default
                </label>
                <p className="text-[11px] text-aether-fg-dim">
                  Key is stored locally in this app (zustand persist).
                </p>
              </>
            )}

            {tab === "about" && <AboutPanel appVersion={appVersion} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function AboutPanel({ appVersion }: { appVersion: string }) {
  const phase = useUpdaterStore((s) => s.phase);
  const availableVersion = useUpdaterStore((s) => s.availableVersion);
  const notes = useUpdaterStore((s) => s.notes);
  const error = useUpdaterStore((s) => s.error);
  const progress = useUpdaterStore((s) => s.progress);
  const check = useUpdaterStore((s) => s.check);
  const installAndRelaunch = useUpdaterStore((s) => s.installAndRelaunch);

  const busy = phase === "checking" || phase === "downloading";
  const pct =
    progress?.contentLength && progress.contentLength > 0
      ? Math.min(
          100,
          Math.round((progress.downloaded / progress.contentLength) * 100),
        )
      : null;

  let statusLine = "Click Check for Updates to query the release feed.";
  if (phase === "checking") statusLine = "Checking for updates…";
  else if (phase === "uptodate") statusLine = "You are on the latest version.";
  else if (phase === "unavailable")
    statusLine = error ?? "Update feed not available yet.";
  else if (phase === "available")
    statusLine = `Update available: v${availableVersion}`;
  else if (phase === "downloading")
    statusLine =
      pct != null
        ? `Downloading… ${pct}%`
        : `Downloading… ${progress?.downloaded ?? 0} bytes`;
  else if (phase === "ready") statusLine = "Installed. Relaunching…";
  else if (phase === "error") statusLine = error ?? "Update failed.";

  return (
    <div className="space-y-2 text-aether-fg">
      <p className="text-sm font-medium">Aether</p>
      <p className="text-aether-fg-dim leading-relaxed">
        IDE for robots, drones, and embedded systems.
      </p>
      <p className="text-aether-fg-muted">Version {appVersion}</p>
      <p className="text-[11px] leading-relaxed text-aether-fg-dim">
        Stack: Tauri 2 · React 19 · TypeScript · Monaco · PlatformIO · clangd ·
        GDB MI · Git
      </p>

      <div className="mt-3 space-y-2 rounded border border-aether-border bg-aether-bg/50 p-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-aether-fg-muted">
          Updates
        </p>
        <p className="text-[11px] leading-relaxed text-aether-fg-dim">
          {statusLine}
        </p>
        {notes && phase === "available" && (
          <p className="max-h-24 overflow-auto whitespace-pre-wrap text-[11px] text-aether-fg-muted">
            {notes}
          </p>
        )}
        {phase === "downloading" && pct != null && (
          <div className="h-1.5 overflow-hidden rounded bg-aether-surface-raised">
            <div
              className="h-full bg-aether-accent transition-[width]"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !isTauriRuntime()}
            onClick={() => void check()}
            className="rounded border border-aether-border px-2.5 py-1.5 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
          >
            {phase === "checking" ? "Checking…" : "Check for Updates"}
          </button>
          {phase === "available" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void installAndRelaunch()}
              className="rounded bg-aether-accent px-2.5 py-1.5 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              Download & Install
            </button>
          )}
        </div>
        <p className="text-[10px] leading-relaxed text-aether-fg-dim">
          Signed updates via Tauri updater. Feed: GitHub Releases{" "}
          <span className="font-mono">latest.json</span> (see docs/UPDATES.md).
        </p>
      </div>

      <p className="text-[11px] text-aether-fg-dim">
        Command Palette:{" "}
        <kbd className="text-aether-fg">Ctrl+Shift+P</kbd>
        {" · "}
        Quick Open: <kbd className="text-aether-fg">Ctrl+P</kbd>
      </p>
    </div>
  );
}
