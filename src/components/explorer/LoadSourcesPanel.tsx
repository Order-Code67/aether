import { useEffect, useState } from "react";
import {
  FolderOpen,
  FolderPlus,
  HardDriveDownload,
  PackagePlus,
  Sparkles,
} from "lucide-react";
import { CoachSteps } from "@/components/hints/CoachSteps";
import { PanelHint } from "@/components/hints/PanelHint";
import { NewProjectDialog } from "@/components/explorer/NewProjectDialog";
import { OpenExamplesDialog } from "@/components/explorer/OpenExamplesDialog";
import { useI18n } from "@/hooks/useI18n";
import { isTauriRuntime } from "@/lib/tauri";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function LoadSourcesPanel() {
  const { t } = useI18n();
  const tauri = isTauriRuntime();
  const openFolder = useWorkspaceStore((s) => s.openFolder);
  const addFolder = useWorkspaceStore((s) => s.addFolder);
  const openDemoWorkspace = useWorkspaceStore((s) => s.openDemoWorkspace);
  const running = usePlatformIoStore((s) => s.running);
  const offlineCache = usePlatformIoStore((s) => s.offlineCache);
  const offlineCacheChecking = usePlatformIoStore((s) => s.offlineCacheChecking);
  const sidecarOfflineZips = usePlatformIoStore((s) => s.sidecarOfflineZips);
  const prepareOfflineCache = usePlatformIoStore((s) => s.prepareOfflineCache);
  const importOfflineCacheZip = usePlatformIoStore((s) => s.importOfflineCacheZip);
  const importSidecarOfflineZip = usePlatformIoStore(
    (s) => s.importSidecarOfflineZip,
  );
  const refreshOfflineCache = usePlatformIoStore((s) => s.refreshOfflineCache);
  const hintsEnabled = useSettingsStore((s) => s.hintsEnabled);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [examplesOpen, setExamplesOpen] = useState(false);

  useEffect(() => {
    if (!tauri) return;
    void refreshOfflineCache();
  }, [tauri, refreshOfflineCache]);

  return (
    <div className="flex h-full flex-col">
      <NewProjectDialog
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
      />
      <OpenExamplesDialog
        open={examplesOpen}
        onClose={() => setExamplesOpen(false)}
      />

      <header className="flex h-9 shrink-0 items-center px-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-aether-fg-muted">
          {t("sources.title")}
        </h2>
      </header>

      <div className="aether-scroll flex-1 space-y-4 overflow-auto px-3 pb-4 text-xs">
        <CoachSteps />
        <PanelHint messageKey="hints.panel.sources" />
        {!hintsEnabled && (
          <p className="leading-relaxed text-aether-fg-dim">{t("sources.hint")}</p>
        )}

        <section className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wide text-aether-fg-dim">
            {t("sources.section.workspace")}
          </p>
          <SourceButton
            icon={FolderOpen}
            label={t("explorer.openFolder")}
            title={t("sources.openFolderTitle")}
            onClick={() => void openFolder()}
          />
          <SourceButton
            icon={FolderPlus}
            label={t("explorer.addFolder")}
            title={t("sources.addFolderTitle")}
            disabled={!tauri}
            onClick={() => void addFolder()}
          />
          <SourceButton
            icon={PackagePlus}
            label={t("explorer.newProject")}
            title={t("sources.newProjectTitle")}
            onClick={() => setNewProjectOpen(true)}
          />
          <SourceButton
            icon={Sparkles}
            label={t("welcome.openDemo")}
            title={t("sources.demoTitle")}
            onClick={() => void openDemoWorkspace()}
          />
        </section>

        <section className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wide text-aether-fg-dim">
            {t("sources.section.catalog")}
          </p>
          <SourceButton
            icon={PackagePlus}
            label={t("welcome.openExample")}
            title={t("sources.examplesTitle")}
            onClick={() => setExamplesOpen(true)}
          />

          <div className="rounded border border-aether-border bg-aether-bg/40 p-2.5">
            <div className="mb-1.5 flex items-center gap-1.5 text-aether-fg">
              <HardDriveDownload size={14} strokeWidth={1.5} />
              <span className="font-medium">{t("offline.title")}</span>
            </div>
            <p className="mb-2 text-[11px] leading-relaxed text-aether-fg-dim">
              {t("sources.offlineTitle")}
            </p>
            {offlineCacheChecking && (
              <p className="mb-2 text-aether-fg-dim">{t("offline.checking")}</p>
            )}
            {offlineCache && (
              <ul className="mb-2 space-y-0.5 text-[11px] text-aether-fg-muted">
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
            {sidecarOfflineZips[0] && (
              <p className="mb-2 text-[11px] text-aether-fg-muted">
                {t("offline.sidecarFound", {
                  file:
                    sidecarOfflineZips[0].path.split(/[/\\]/).pop() ??
                    sidecarOfflineZips[0].path,
                })}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                title={t("sources.offlineTitle")}
                disabled={running || !tauri}
                onClick={() => void prepareOfflineCache()}
                className="rounded border border-aether-accent bg-aether-accent px-2 py-1 text-[11px] text-white hover:opacity-90 disabled:opacity-40"
              >
                {running ? t("offline.preparing") : t("offline.prepare")}
              </button>
              {sidecarOfflineZips.length > 0 && (
                <button
                  type="button"
                  title={t("offline.importSidecar")}
                  disabled={running || !tauri}
                  onClick={() => void importSidecarOfflineZip()}
                  className="rounded border border-aether-border bg-aether-surface px-2 py-1 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
                >
                  {running
                    ? t("offline.importing")
                    : t("offline.importSidecar")}
                </button>
              )}
              <button
                type="button"
                title={t("offline.import")}
                disabled={running || !tauri}
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
                className="rounded border border-aether-border bg-aether-surface px-2 py-1 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
              >
                {running ? t("offline.importing") : t("offline.import")}
              </button>
              <button
                type="button"
                title={t("common.refresh")}
                disabled={offlineCacheChecking}
                onClick={() => void refreshOfflineCache()}
                className="rounded border border-aether-border bg-aether-surface px-2 py-1 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
              >
                {t("common.refresh")}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SourceButton({
  icon: Icon,
  label,
  title,
  onClick,
  disabled,
}: {
  icon: typeof FolderOpen;
  label: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded border border-aether-border bg-aether-bg/40 px-2.5 py-2 text-left text-aether-fg hover:bg-aether-surface-raised disabled:cursor-default disabled:opacity-40"
    >
      <Icon size={15} strokeWidth={1.5} className="shrink-0 text-aether-fg-muted" />
      <span>{label}</span>
    </button>
  );
}
