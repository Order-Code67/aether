import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import type { Locale } from "@/i18n";
import { cn } from "@/lib/cn";
import { isTauriRuntime } from "@/lib/tauri";
import { useAgentStore } from "@/stores/agentStore";
import { usePlatformIoStore } from "@/stores/platformioStore";
import {
  useSettingsStore,
  type SettingsTabId,
  type WordWrapSetting,
} from "@/stores/settingsStore";
import { useUpdaterStore } from "@/stores/updaterStore";
import { copyTextToClipboard } from "@/lib/clipboard";
import {
  buildSupportReportText,
  saveSupportReportToDisk,
} from "@/lib/supportReport";
import { localizeUpdateNotes } from "@/lib/updateNotes";
import { FirmwareProfilesSection } from "@/components/settings/FirmwareProfilesSection";

type SettingsTab = SettingsTabId;

export function SettingsDialog() {
  const { t, locale, setLocale } = useI18n();
  const open = useSettingsStore((s) => s.settingsOpen);
  const closeSettings = useSettingsStore((s) => s.closeSettings);
  const consumeInitialTab = useSettingsStore((s) => s.consumeInitialTab);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const arduinoMode = useSettingsStore((s) => s.arduinoMode);
  const setArduinoMode = useSettingsStore((s) => s.setArduinoMode);
  const sketchMode = useSettingsStore((s) => s.sketchMode);
  const showAllFiles = useSettingsStore((s) => s.showAllFiles);
  const setSketchMode = useSettingsStore((s) => s.setSketchMode);
  const setShowAllFiles = useSettingsStore((s) => s.setShowAllFiles);
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

  const offlineCache = usePlatformIoStore((s) => s.offlineCache);
  const offlineCacheChecking = usePlatformIoStore((s) => s.offlineCacheChecking);
  const running = usePlatformIoStore((s) => s.running);
  const refreshOfflineCache = usePlatformIoStore((s) => s.refreshOfflineCache);
  const prepareOfflineCache = usePlatformIoStore((s) => s.prepareOfflineCache);
  const importOfflineCacheZip = usePlatformIoStore((s) => s.importOfflineCacheZip);

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

  const [tab, setTab] = useState<SettingsTab>("general");
  const [appVersion, setAppVersion] = useState<string>("0.1.0");
  const [vscodeStatus, setVscodeStatus] = useState<
    "idle" | "checking" | { installed: true; path: string } | { installed: false }
  >("idle");
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

  useEffect(() => {
    if (!open || tab !== "tools") return;
    void refreshOfflineCache();
  }, [open, tab, refreshOfflineCache]);

  useEffect(() => {
    if (!open || tab !== "tools" || !isTauriRuntime()) {
      return;
    }
    setVscodeStatus("checking");
    void import("@/lib/vscodeIntegration")
      .then(({ detectVsCode }) => detectVsCode())
      .then((info) => {
        if (info.installed && info.path) {
          setVscodeStatus({ installed: true, path: info.path });
        } else {
          setVscodeStatus({ installed: false });
        }
      })
      .catch(() => setVscodeStatus({ installed: false }));
  }, [open, tab]);

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
          <h2 className="text-sm font-medium text-aether-fg">
            {t("settings.title")}
          </h2>
          <button
            type="button"
            title={t("settings.close")}
            aria-label={t("settings.close")}
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
                ["general", "settings.general"],
                ["editor", "settings.editor"],
                ["tools", "settings.tools"],
                ["agent", "settings.agent"],
                ["about", "settings.about"],
              ] as const
            ).map(([id, labelKey]) => (
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
                {t(labelKey)}
              </button>
            ))}
          </nav>

          <div className="aether-scroll min-h-0 flex-1 space-y-3 overflow-auto p-4 text-xs">
            {tab === "general" && (
              <>
                <label className="flex items-center justify-between gap-3">
                  <span className="text-aether-fg">{t("settings.language")}</span>
                  <select
                    value={locale}
                    onChange={(e) => setLocale(e.target.value as Locale)}
                    className="rounded border border-aether-border bg-aether-bg px-2 py-1 text-aether-fg outline-none focus:border-aether-accent"
                  >
                    <option value="ru">{t("settings.language.ru")}</option>
                    <option value="en">{t("settings.language.en")}</option>
                  </select>
                </label>

                <div className="space-y-2 border-t border-aether-border pt-3">
                  <p className="font-medium text-aether-fg">
                    {t("settings.appearance")}
                  </p>
                  <label className="flex items-center justify-between gap-3">
                    <span className="text-aether-fg">{t("settings.theme")}</span>
                    <select
                      value={theme}
                      onChange={(e) =>
                        setTheme(e.target.value === "light" ? "light" : "dark")
                      }
                      className="rounded border border-aether-border bg-aether-bg px-2 py-1 text-aether-fg outline-none focus:border-aether-accent"
                    >
                      <option value="dark">{t("settings.theme.dark")}</option>
                      <option value="light">{t("settings.theme.light")}</option>
                    </select>
                  </label>
                  <label className="flex items-start justify-between gap-3">
                    <span className="space-y-0.5">
                      <span className="block text-aether-fg">
                        {t("settings.arduinoMode")}
                      </span>
                      <span className="block text-[11px] text-aether-fg-muted">
                        {t("settings.arduinoModeHint")}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={arduinoMode}
                      onChange={(e) => setArduinoMode(e.target.checked)}
                      className="mt-0.5"
                    />
                  </label>
                </div>

                <label className="flex items-start justify-between gap-3 border-t border-aether-border pt-3">
                  <span className="space-y-0.5">
                    <span className="block text-aether-fg">
                      {t("sketch.mode")}
                    </span>
                    <span className="block text-[11px] text-aether-fg-muted">
                      {t("sketch.modeHint")}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={sketchMode}
                    onChange={(e) => setSketchMode(e.target.checked)}
                    className="mt-0.5"
                  />
                </label>
                {sketchMode && (
                  <label className="flex items-center justify-between gap-3">
                    <span className="text-aether-fg">{t("sketch.showAll")}</span>
                    <input
                      type="checkbox"
                      checked={showAllFiles}
                      onChange={(e) => setShowAllFiles(e.target.checked)}
                    />
                  </label>
                )}

                <FirmwareProfilesSection />
              </>
            )}
            {tab === "tools" && (
              <div className="space-y-3">
                <div className="space-y-2 border-b border-aether-border pb-3">
                  <div>
                    <p className="font-medium text-aether-fg">
                      {t("vscode.settingsTitle")}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-aether-fg-muted">
                      {t("vscode.settingsHint")}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-aether-fg-dim">
                      {vscodeStatus === "checking" || vscodeStatus === "idle"
                        ? t("vscode.statusChecking")
                        : vscodeStatus.installed
                          ? t("vscode.statusInstalled", { path: vscodeStatus.path })
                          : t("vscode.statusMissing")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!isTauriRuntime()}
                      onClick={() => {
                        void import("@/lib/commands").then(({ runCommandById }) => {
                          runCommandById("file.openInVsCode");
                        });
                      }}
                      className="rounded border border-aether-accent bg-aether-accent px-2.5 py-1.5 text-[11px] text-white hover:opacity-90 disabled:opacity-40"
                    >
                      {t("vscode.openAction")}
                    </button>
                    <button
                      type="button"
                      disabled={!isTauriRuntime()}
                      onClick={() => {
                        void import("@/lib/commands").then(({ runCommandById }) => {
                          runCommandById("file.generateVsCodeConfig");
                        });
                      }}
                      className="rounded border border-aether-border bg-aether-bg px-2.5 py-1.5 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
                    >
                      {t("vscode.generateAction")}
                    </button>
                  </div>
                </div>
                <div>
                  <p className="font-medium text-aether-fg">
                    {t("offline.title")}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-aether-fg-muted">
                    {t("offline.hint")}
                  </p>
                </div>
                {offlineCacheChecking && (
                  <p className="text-aether-fg-dim">{t("offline.checking")}</p>
                )}
                {offlineCache && (
                  <ul className="space-y-1 text-aether-fg-muted">
                    <li>
                      {t("offline.home")}:{" "}
                      <span className="text-aether-fg">
                        {offlineCache.home ?? "—"}
                      </span>
                    </li>
                    <li>
                      espressif32:{" "}
                      {offlineCache.espressif32
                        ? t("offline.present")
                        : t("offline.missing")}
                    </li>
                    <li>
                      atmelavr:{" "}
                      {offlineCache.atmelavr
                        ? t("offline.present")
                        : t("offline.missing")}
                    </li>
                  </ul>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={running || !isTauriRuntime()}
                    onClick={() => {
                      void prepareOfflineCache();
                    }}
                    className="rounded border border-aether-accent bg-aether-accent px-2.5 py-1.5 text-[11px] text-white hover:opacity-90 disabled:opacity-40"
                  >
                    {running ? t("offline.preparing") : t("offline.prepare")}
                  </button>
                  <button
                    type="button"
                    disabled={running || !isTauriRuntime()}
                    onClick={() => {
                      void (async () => {
                        const { open } = await import("@tauri-apps/plugin-dialog");
                        const selected = await open({
                          multiple: false,
                          filters: [
                            { name: "Offline cache", extensions: ["zip"] },
                          ],
                          title: t("offline.import"),
                        });
                        if (typeof selected === "string" && selected) {
                          void importOfflineCacheZip(selected);
                        }
                      })();
                    }}
                    className="rounded border border-aether-border bg-aether-bg px-2.5 py-1.5 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
                  >
                    {running ? t("offline.importing") : t("offline.import")}
                  </button>
                  <button
                    type="button"
                    disabled={offlineCacheChecking}
                    onClick={() => {
                      void refreshOfflineCache();
                    }}
                    className="rounded border border-aether-border bg-aether-bg px-2.5 py-1.5 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
                  >
                    {t("doctor.recheck")}
                  </button>
                </div>
                <p className="text-[11px] leading-relaxed text-aether-fg-dim">
                  {t("offline.importHint")}
                </p>
                <p className="text-[11px] leading-relaxed text-aether-fg-dim">
                  {t("offline.reuseNote")}
                </p>
              </div>
            )}
            {tab === "editor" && (
              <>
                <label className="flex items-center justify-between gap-3">
                  <span className="text-aether-fg">{t("settings.fontSize")}</span>
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
                  <span className="text-aether-fg">{t("settings.tabSize")}</span>
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
                  <span className="text-aether-fg">{t("settings.wordWrap")}</span>
                  <select
                    value={wordWrap}
                    onChange={(e) =>
                      setWordWrap(e.target.value as WordWrapSetting)
                    }
                    className="rounded border border-aether-border bg-aether-bg px-2 py-1 text-aether-fg outline-none focus:border-aether-accent"
                  >
                    <option value="off">{t("settings.wordWrap.off")}</option>
                    <option value="on">{t("settings.wordWrap.on")}</option>
                    <option value="wordWrapColumn">
                      {t("settings.wordWrap.column")}
                    </option>
                  </select>
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span className="text-aether-fg">
                    {t("settings.renderWhitespace")}
                  </span>
                  <select
                    value={renderWhitespace}
                    onChange={(e) =>
                      setRenderWhitespace(
                        e.target.value as "none" | "selection" | "all",
                      )
                    }
                    className="rounded border border-aether-border bg-aether-bg px-2 py-1 text-aether-fg outline-none focus:border-aether-accent"
                  >
                    <option value="none">
                      {t("settings.renderWhitespace.none")}
                    </option>
                    <option value="selection">
                      {t("settings.renderWhitespace.selection")}
                    </option>
                    <option value="all">
                      {t("settings.renderWhitespace.all")}
                    </option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-aether-fg">
                  <input
                    type="checkbox"
                    checked={minimap}
                    onChange={(e) => setMinimap(e.target.checked)}
                  />
                  {t("settings.minimap")}
                </label>
                <label className="flex items-center gap-2 text-aether-fg">
                  <input
                    type="checkbox"
                    checked={fontLigatures}
                    onChange={(e) => setFontLigatures(e.target.checked)}
                  />
                  {t("settings.fontLigatures")}
                </label>
                <label className="flex items-center gap-2 text-aether-fg">
                  <input
                    type="checkbox"
                    checked={lineNumbers}
                    onChange={(e) => setLineNumbers(e.target.checked)}
                  />
                  {t("settings.lineNumbers")}
                </label>
                <button
                  type="button"
                  onClick={resetEditorDefaults}
                  className="rounded border border-aether-border px-2 py-1.5 text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
                >
                  {t("settings.resetEditor")}
                </button>
                <p className="text-[11px] text-aether-fg-dim">
                  {t("settings.editorFindHint")}
                </p>
              </>
            )}

            {tab === "agent" && (
              <>
                <label className="block">
                  <span className="text-aether-fg-dim">
                    {t("settings.agent.baseUrl")}
                  </span>
                  <input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className="mt-0.5 w-full rounded border border-aether-border bg-aether-bg px-2 py-1.5 text-aether-fg outline-none focus:border-aether-accent"
                  />
                </label>
                <label className="block">
                  <span className="text-aether-fg-dim">
                    {t("settings.agent.apiKey")}
                  </span>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="mt-0.5 w-full rounded border border-aether-border bg-aether-bg px-2 py-1.5 text-aether-fg outline-none focus:border-aether-accent"
                    autoComplete="off"
                  />
                </label>
                <label className="block">
                  <span className="text-aether-fg-dim">
                    {t("settings.agent.model")}
                  </span>
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
                  {t("settings.agent.attachFile")}
                </label>
                <label className="flex items-center gap-2 text-aether-fg">
                  <input
                    type="checkbox"
                    checked={includeProblems}
                    onChange={(e) => setIncludeProblems(e.target.checked)}
                  />
                  {t("settings.agent.attachProblems")}
                </label>
                <p className="text-[11px] text-aether-fg-dim">
                  {t("settings.agent.keyHint")}
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
  const { t, locale } = useI18n();
  const phase = useUpdaterStore((s) => s.phase);
  const availableVersion = useUpdaterStore((s) => s.availableVersion);
  const notes = useUpdaterStore((s) => s.notes);
  const error = useUpdaterStore((s) => s.error);
  const progress = useUpdaterStore((s) => s.progress);
  const lastCheckedAt = useUpdaterStore((s) => s.lastCheckedAt);
  const check = useUpdaterStore((s) => s.check);
  const installAndRelaunch = useUpdaterStore((s) => s.installAndRelaunch);
  const openDialog = useUpdaterStore((s) => s.openDialog);
  const updateChannel = useSettingsStore((s) => s.updateChannel);
  const setUpdateChannel = useSettingsStore((s) => s.setUpdateChannel);
  const flashNotice = useSettingsStore((s) => s.flashNotice);
  const [copying, setCopying] = useState(false);
  const [saving, setSaving] = useState(false);

  const busy = phase === "checking" || phase === "downloading";
  const pct =
    progress?.contentLength && progress.contentLength > 0
      ? Math.min(
          100,
          Math.round((progress.downloaded / progress.contentLength) * 100),
        )
      : null;

  let statusLine = t("updater.hint");
  if (phase === "checking") statusLine = t("updater.checking");
  else if (phase === "uptodate") statusLine = t("updater.uptodate");
  else if (phase === "unavailable")
    statusLine = error ?? t("updater.unavailable");
  else if (phase === "available")
    statusLine = t("updater.available", { version: availableVersion ?? "?" });
  else if (phase === "downloading")
    statusLine =
      pct != null
        ? t("updater.downloadingPct", { pct })
        : t("updater.downloading");
  else if (phase === "ready") statusLine = t("updater.ready");
  else if (phase === "error") statusLine = error ?? t("updater.failed");

  const lastCheckLabel =
    lastCheckedAt != null
      ? t("updater.lastCheck", {
          time: new Date(lastCheckedAt).toLocaleString(
            locale === "ru" ? "ru-RU" : "en-US",
          ),
        })
      : t("updater.neverChecked");

  const displayNotes = localizeUpdateNotes(availableVersion, notes, locale);

  return (
    <div className="space-y-2 text-aether-fg" data-aether-focus-surface="dialog">
      <div className="flex items-center gap-3">
        <img
          src="/aether-icon.png"
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 rounded-sm"
        />
        <div className="min-w-0">
          <p className="text-sm font-medium">{t("app.name")}</p>
          <p className="text-aether-fg-muted">
            {t("updater.version", { version: appVersion })}
          </p>
        </div>
      </div>
      <p className="text-aether-fg-dim leading-relaxed">{t("app.tagline")}</p>
      <p className="text-[11px] leading-relaxed text-aether-fg-dim">
        {t("settings.stack")}
      </p>

      <div className="mt-3 space-y-2 rounded border border-aether-border bg-aether-bg/50 p-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-aether-fg-muted">
          {t("updater.section")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-aether-fg-muted">
            {t("updater.channel")}
          </span>
          <div className="inline-flex rounded border border-aether-border overflow-hidden">
            <button
              type="button"
              disabled={busy}
              onClick={() => setUpdateChannel("stable")}
              className={cn(
                "px-2.5 py-1 text-[11px]",
                updateChannel === "stable"
                  ? "bg-aether-accent text-white"
                  : "bg-aether-bg text-aether-fg hover:bg-aether-surface-raised",
              )}
            >
              {t("updater.channel.stable")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setUpdateChannel("beta")}
              className={cn(
                "px-2.5 py-1 text-[11px]",
                updateChannel === "beta"
                  ? "bg-aether-accent text-white"
                  : "bg-aether-bg text-aether-fg hover:bg-aether-surface-raised",
              )}
            >
              {t("updater.channel.beta")}
            </button>
          </div>
        </div>
        <p className="text-[10px] leading-relaxed text-aether-fg-dim">
          {t("updater.channelHint")}
        </p>
        <p className="text-[11px] leading-relaxed text-aether-fg-dim">
          {statusLine}
        </p>
        <p className="text-[10px] text-aether-fg-dim">{lastCheckLabel}</p>
        {phase === "available" && (
          <p className="max-h-24 overflow-auto whitespace-pre-wrap text-[11px] text-aether-fg-muted">
            {displayNotes}
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
            onClick={() => {
              void check({ openDialog: true }).then(() => {
                if (useUpdaterStore.getState().phase === "available") {
                  openDialog();
                }
              });
            }}
            className="rounded border border-aether-border px-2.5 py-1.5 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
          >
            {phase === "checking" ? t("updater.checking") : t("updater.check")}
          </button>
          {phase === "available" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void installAndRelaunch()}
              className="rounded bg-aether-accent px-2.5 py-1.5 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              {t("updater.install")}
            </button>
          )}
        </div>
        <p className="text-[10px] leading-relaxed text-aether-fg-dim">
          {t("updater.feedHint")}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={copying}
          onClick={() => {
            setCopying(true);
            void (async () => {
              try {
                const text = await buildSupportReportText(locale);
                const ok = await copyTextToClipboard(text);
                flashNotice(ok ? t("support.copied") : t("support.copyFailed"));
              } finally {
                setCopying(false);
              }
            })();
          }}
          className="rounded border border-aether-border px-2.5 py-1.5 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
        >
          {t("support.copyReport")}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setSaving(true);
            void (async () => {
              try {
                const path = await saveSupportReportToDisk(locale);
                if (path) {
                  flashNotice(t("support.saved", { path }), 4500);
                }
              } catch {
                flashNotice(t("support.saveFailed"));
              } finally {
                setSaving(false);
              }
            })();
          }}
          className="rounded border border-aether-border px-2.5 py-1.5 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
        >
          {t("support.saveReport")}
        </button>
      </div>

      <p className="text-[11px] text-aether-fg-dim">
        {t("settings.shortcutsHint")}
      </p>
    </div>
  );
}
