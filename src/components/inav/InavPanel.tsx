import { useEffect, useRef, useState } from "react";
import { ChartLine, Eraser, ExternalLink, FolderOpen, Save, Send } from "lucide-react";
import { InavBatteryCard } from "@/components/inav/InavBatteryCard";
import { InavFailsafeCard } from "@/components/inav/InavFailsafeCard";
import { InavFlashCard } from "@/components/inav/InavFlashCard";
import { InavGpsNavCard } from "@/components/inav/InavGpsNavCard";
import { InavMixerCard } from "@/components/inav/InavMixerCard";
import { InavModesCard } from "@/components/inav/InavModesCard";
import { InavOnboardingChecklist } from "@/components/inav/InavOnboardingChecklist";
import { InavParamsCard } from "@/components/inav/InavParamsCard";
import { InavPidCard } from "@/components/inav/InavPidCard";
import { InavPortsCard } from "@/components/inav/InavPortsCard";
import { InavPresetsCard } from "@/components/inav/InavPresetsCard";
import { InavRatesCard } from "@/components/inav/InavRatesCard";
import { InavReceiverCard } from "@/components/inav/InavReceiverCard";
import { InavStatusCard } from "@/components/inav/InavStatusCard";
import { useI18n } from "@/hooks/useI18n";
import { openExternalUrl } from "@/lib/comDrivers";
import {
  detectInavConfigurator,
  INAV_CONFIGURATOR_DOWNLOAD_URL,
  openInavConfigurator,
} from "@/lib/inavConfigurator";
import { splitDiffForCliSend } from "@/lib/inavDiff";
import { loadInavDiffFromFile, saveInavDiffToFile } from "@/lib/inavDiffFile";
import { isTauriRuntime } from "@/lib/tauri";
import { useInavStore } from "@/stores/inavStore";
import { useLayoutStore } from "@/stores/layoutStore";
import { useSerialStore } from "@/stores/serialStore";
import { useSettingsStore } from "@/stores/settingsStore";

const QUICK_CMDS = ["help", "version", "status", "diff"] as const;
const DIFF_CAPTURE_MS = 8000;

/** Main configurator pages — connection lives in the sidebar; HUD in the workspace chrome. */
export function InavPanel() {
  const { t, locale } = useI18n();
  const tauri = isTauriRuntime();
  const [input, setInput] = useState("");
  const [sendingDiff, setSendingDiff] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const selectedPath = useSerialStore((s) => s.selectedPath);
  const connected = useSerialStore((s) => s.connected);
  const send = useSerialStore((s) => s.send);

  const sessionActive = useInavStore((s) => s.sessionActive);
  const tab = useInavStore((s) => s.activeTab);
  const capturingDiff = useInavStore((s) => s.capturingDiff);
  const cliLines = useInavStore((s) => s.cliLines);
  const diffBuffer = useInavStore((s) => s.diffBuffer);
  const lastDiffPath = useInavStore((s) => s.lastDiffPath);
  const profiles = useInavStore((s) => s.profiles);
  const draftName = useInavStore((s) => s.draftName);
  const draftNotes = useInavStore((s) => s.draftNotes);
  const clearCli = useInavStore((s) => s.clearCli);
  const setDiffBuffer = useInavStore((s) => s.setDiffBuffer);
  const setCapturingDiff = useInavStore((s) => s.setCapturingDiff);
  const setLastDiffPath = useInavStore((s) => s.setLastDiffPath);
  const setDraftName = useInavStore((s) => s.setDraftName);
  const setDraftNotes = useInavStore((s) => s.setDraftNotes);
  const releasePort = useInavStore((s) => s.releasePort);
  const saveCurrentAs = useInavStore((s) => s.saveCurrentAs);
  const applyProfile = useInavStore((s) => s.applyProfile);
  const deleteProfile = useInavStore((s) => s.deleteProfile);

  const flash = useSettingsStore((s) => s.flashNotice);
  const setBottomPanelTab = useLayoutStore((s) => s.setBottomPanelTab);
  const setBottomPanelVisible = useLayoutStore((s) => s.setBottomPanelVisible);

  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [cliLines]);

  const onSend = (text: string) => {
    if (!connected) {
      flash(t("inav.needConnect"));
      return;
    }
    void send(text, true);
  };

  const onSubmit = () => {
    if (!input.trim() && input.length === 0) return;
    onSend(input);
    setInput("");
  };

  const onDump = () => {
    if (!window.confirm(t("inav.dumpConfirm"))) return;
    onSend("dump");
  };

  const onGetDiff = () => {
    if (!connected) {
      flash(t("inav.needConnect"));
      return;
    }
    setDiffBuffer("");
    setCapturingDiff(true);
    flash(t("inav.diffCapturing"));
    void send("diff all", true);
    window.setTimeout(() => {
      useInavStore.getState().setCapturingDiff(false);
      useSettingsStore.getState().flashNotice(t("inav.diffReady"));
    }, DIFF_CAPTURE_MS);
  };

  const onSaveDiff = async () => {
    try {
      const path = await saveInavDiffToFile(diffBuffer, locale, selectedPath);
      if (path) {
        setLastDiffPath(path);
        flash(t("inav.diffSaved", { path }));
      }
    } catch (e) {
      flash(e instanceof Error ? e.message : t("inav.diffSaveFailed"));
    }
  };

  const sendDiffLines = async (content: string) => {
    if (!connected) {
      flash(t("inav.needConnect"));
      return;
    }
    if (!window.confirm(t("inav.loadDiffConfirm"))) return;
    setSendingDiff(true);
    try {
      const lines = splitDiffForCliSend(content);
      for (const line of lines) {
        await send(line, true);
        await new Promise((r) => setTimeout(r, 40));
      }
      flash(t("inav.diffSent", { count: lines.length }));
    } finally {
      setSendingDiff(false);
    }
  };

  const onLoadDiff = async () => {
    try {
      const loaded = await loadInavDiffFromFile(locale);
      if (!loaded) return;
      setDiffBuffer(loaded.content);
      setLastDiffPath(loaded.path);
      if (!connected) {
        flash(t("inav.diffLoadedNeedConnect"));
        return;
      }
      await sendDiffLines(loaded.content);
    } catch (e) {
      flash(e instanceof Error ? e.message : t("inav.diffLoadFailed"));
    }
  };

  const onSendBuffer = () => {
    void sendDiffLines(diffBuffer);
  };

  const onOpenConfigurator = async () => {
    await releasePort();
    try {
      const info = await detectInavConfigurator();
      if (!info.installed) {
        const go = window.confirm(t("inav.configuratorMissing"));
        if (go) {
          await openExternalUrl(INAV_CONFIGURATOR_DOWNLOAD_URL);
        }
        return;
      }
      await openInavConfigurator();
      flash(t("inav.configuratorLaunched"));
    } catch (e) {
      const msg =
        e instanceof Error && e.message === "INAV_DESKTOP_REQUIRED"
          ? t("inav.desktopRequired")
          : e instanceof Error
            ? e.message
            : t("inav.configuratorFailed");
      flash(msg);
      const go = window.confirm(t("inav.configuratorMissing"));
      if (go) {
        await openExternalUrl(INAV_CONFIGURATOR_DOWNLOAD_URL);
      }
    }
  };

  const onOpenPlotter = () => {
    setBottomPanelVisible(true);
    setBottomPanelTab("plotter");
  };

  const onSaveProfile = () => {
    const name =
      draftName.trim() ||
      window.prompt(t("inav.profileNamePrompt"), selectedPath || "iNav") ||
      "";
    if (!name.trim()) return;
    setDraftName(name.trim());
    saveCurrentAs(name.trim());
    flash(t("inav.profileSaved", { name: name.trim() }));
  };

  if (!tauri) {
    return (
      <div
        className="flex h-full flex-col px-4 py-3 text-xs text-aether-fg-dim"
        data-testid="inav-panel"
      >
        <p>{t("inav.desktopRequired")}</p>
        <span className="mt-1 font-mono text-aether-fg-muted">
          npm run tauri:dev
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="inav-panel">
      <div className="flex shrink-0 items-center justify-end gap-2 border-b border-aether-border/60 px-4 py-1">
        <button
          type="button"
          title={t("inav.openPlotter")}
          onClick={onOpenPlotter}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
        >
          <ChartLine size={12} />
          {t("inav.openPlotter")}
        </button>
      </div>

      <div className="aether-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-4 py-3 text-xs md:px-6">
        {tab === "setup" && (
          <>
            <p className="text-[11px] leading-relaxed text-aether-fg-dim">
              {t("inav.hint")}
            </p>
            <InavOnboardingChecklist
              onOpenConfigurator={() => void onOpenConfigurator()}
              onRefreshStatus={() =>
                void useInavStore.getState().refreshMspStatus()
              }
              onGetDiff={onGetDiff}
            />
            <InavStatusCard
              connected={connected}
              sessionActive={sessionActive}
            />
            <section className="space-y-1.5">
              <button
                type="button"
                data-testid="inav-open-configurator"
                onClick={() => void onOpenConfigurator()}
                className="flex w-full items-center justify-center gap-1.5 rounded border border-aether-border px-2 py-1.5 text-[11px] text-aether-fg hover:bg-aether-surface-raised"
              >
                <ExternalLink size={12} />
                {t("inav.openConfigurator")}
              </button>
              <p className="text-[10px] leading-relaxed text-aether-fg-dim">
                {t("inav.configuratorHint")}
              </p>
            </section>
            <section className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-wide text-aether-fg-dim">
                {t("inav.profiles")}
              </p>
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder={t("inav.profileName")}
                className="h-7 w-full rounded border border-aether-border bg-aether-bg px-2 text-[11px] text-aether-fg outline-none focus:border-aether-accent"
              />
              <textarea
                value={draftNotes}
                onChange={(e) => setDraftNotes(e.target.value)}
                rows={2}
                placeholder={t("inav.profileNotes")}
                className="w-full resize-y rounded border border-aether-border bg-aether-bg p-2 text-[11px] text-aether-fg outline-none focus:border-aether-accent"
              />
              <button
                type="button"
                onClick={onSaveProfile}
                className="rounded border border-aether-border px-2 py-1 text-[11px] text-aether-fg hover:bg-aether-surface-raised"
              >
                {t("inav.saveProfile")}
              </button>
              {profiles.length === 0 ? (
                <p className="text-[11px] text-aether-fg-dim">
                  {t("inav.profilesEmpty")}
                </p>
              ) : (
                <ul className="space-y-1">
                  {profiles.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded border border-aether-border px-2 py-1"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          applyProfile(p.id);
                          flash(t("inav.profileApplied", { name: p.name }));
                        }}
                        className="min-w-0 flex-1 text-left hover:text-aether-accent"
                      >
                        <span className="block truncate font-medium text-aether-fg">
                          {p.name}
                        </span>
                        <span className="block truncate text-[10px] text-aether-fg-dim">
                          {p.port || "—"} · {p.baud}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(t("inav.deleteProfileConfirm"))) {
                            deleteProfile(p.id);
                          }
                        }}
                        className="shrink-0 text-[10px] text-aether-fg-dim hover:text-aether-danger"
                      >
                        {t("inav.delete")}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {tab === "pid" && (
          <InavPidCard connected={connected} sessionActive={sessionActive} />
        )}
        {tab === "rates" && (
          <InavRatesCard connected={connected} sessionActive={sessionActive} />
        )}
        {tab === "receiver" && (
          <InavReceiverCard
            connected={connected}
            sessionActive={sessionActive}
          />
        )}
        {tab === "battery" && (
          <InavBatteryCard
            connected={connected}
            sessionActive={sessionActive}
          />
        )}
        {tab === "failsafe" && (
          <InavFailsafeCard
            connected={connected}
            sessionActive={sessionActive}
          />
        )}
        {tab === "gps" && (
          <InavGpsNavCard connected={connected} sessionActive={sessionActive} />
        )}
        {tab === "mixer" && (
          <InavMixerCard connected={connected} sessionActive={sessionActive} />
        )}
        {tab === "ports" && (
          <InavPortsCard connected={connected} sessionActive={sessionActive} />
        )}
        {tab === "modes" && (
          <InavModesCard connected={connected} sessionActive={sessionActive} />
        )}
        {tab === "params" && (
          <InavParamsCard connected={connected} sessionActive={sessionActive} />
        )}
        {tab === "presets" && (
          <InavPresetsCard
            connected={connected}
            sessionActive={sessionActive}
          />
        )}

        {tab === "cli" && (
          <section className="flex min-h-[220px] flex-1 flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wide text-aether-fg-dim">
                {t("inav.cli")}
              </p>
              <button
                type="button"
                onClick={() => clearCli()}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
              >
                <Eraser size={11} />
                {t("inav.clear")}
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {QUICK_CMDS.map((cmd) => (
                <button
                  key={cmd}
                  type="button"
                  disabled={!connected}
                  onClick={() => onSend(cmd)}
                  className="rounded border border-aether-border px-1.5 py-0.5 font-mono text-[10px] text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg disabled:opacity-40"
                >
                  {cmd}
                </button>
              ))}
              <button
                type="button"
                disabled={!connected}
                onClick={onDump}
                className="rounded border border-aether-border px-1.5 py-0.5 font-mono text-[10px] text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg disabled:opacity-40"
              >
                dump
              </button>
            </div>
            <div
              ref={logRef}
              data-testid="inav-cli-log"
              className="aether-scroll min-h-[140px] flex-1 overflow-auto rounded border border-aether-border bg-aether-bg p-2 font-mono text-[11px] leading-relaxed text-aether-fg"
            >
              {cliLines.length === 0 ? (
                <span className="text-aether-fg-dim">{t("inav.cliEmpty")}</span>
              ) : (
                cliLines.map((line, i) => (
                  <div
                    key={`${i}-${line.slice(0, 12)}`}
                    className="whitespace-pre-wrap break-all"
                  >
                    {line}
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-1">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onSubmit();
                  }
                }}
                disabled={!connected}
                placeholder={t("inav.cliPlaceholder")}
                data-testid="inav-cli-input"
                className="h-7 flex-1 rounded border border-aether-border bg-aether-bg px-2 font-mono text-[11px] text-aether-fg outline-none focus:border-aether-accent disabled:opacity-40"
              />
              <button
                type="button"
                disabled={!connected}
                onClick={onSubmit}
                className="flex h-7 items-center gap-1 rounded border border-aether-border px-2 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
              >
                <Send size={12} />
                {t("inav.send")}
              </button>
            </div>
          </section>
        )}

        {tab === "diff" && (
          <section className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-wide text-aether-fg-dim">
              {t("inav.diff")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={!connected || capturingDiff}
                onClick={onGetDiff}
                data-testid="inav-get-diff"
                className="rounded border border-aether-border px-2 py-1 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
              >
                {capturingDiff ? t("inav.diffCapturing") : t("inav.getDiff")}
              </button>
              <button
                type="button"
                disabled={!diffBuffer.trim()}
                onClick={() => void onSaveDiff()}
                className="flex items-center gap-1 rounded border border-aether-border px-2 py-1 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
              >
                <Save size={11} />
                {t("inav.saveDiff")}
              </button>
              <button
                type="button"
                disabled={sendingDiff}
                onClick={() => void onLoadDiff()}
                className="flex items-center gap-1 rounded border border-aether-border px-2 py-1 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
              >
                <FolderOpen size={11} />
                {t("inav.loadDiff")}
              </button>
              <button
                type="button"
                disabled={!connected || sendingDiff || !diffBuffer.trim()}
                onClick={() => void onSendBuffer()}
                className="rounded border border-aether-border px-2 py-1 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
              >
                {t("inav.sendDiff")}
              </button>
            </div>
            {lastDiffPath && (
              <p
                className="truncate text-[10px] text-aether-fg-dim"
                title={lastDiffPath}
              >
                {t("inav.lastDiff")}: {lastDiffPath}
              </p>
            )}
            <textarea
              value={diffBuffer}
              onChange={(e) => setDiffBuffer(e.target.value)}
              rows={12}
              spellCheck={false}
              data-testid="inav-diff-buffer"
              className="aether-scroll w-full resize-y rounded border border-aether-border bg-aether-bg p-2 font-mono text-[10px] text-aether-fg outline-none focus:border-aether-accent"
              placeholder={t("inav.diffPlaceholder")}
            />
          </section>
        )}

        {tab === "flash" && <InavFlashCard />}
      </div>
    </div>
  );
}
