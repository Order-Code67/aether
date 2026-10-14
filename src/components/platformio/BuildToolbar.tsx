import { useEffect } from "react";
import {
  BookmarkPlus,
  FileCode2,
  Hammer,
  Loader2,
  RefreshCw,
  Stethoscope,
  Trash2,
  Upload,
} from "lucide-react";
import { PanelHint } from "@/components/hints/PanelHint";
import { Tooltip } from "@/components/ui/Tooltip";
import { useI18n } from "@/hooks/useI18n";
import type { MessageKey } from "@/i18n";
import { cn } from "@/lib/cn";
import type { PioStage } from "@/lib/pioProgress";
import { useFirmwareProfileStore } from "@/stores/firmwareProfileStore";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useSerialStore } from "@/stores/serialStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

const STAGE_KEYS: Partial<Record<PioStage, MessageKey>> = {
  starting: "pio.stage.starting",
  compiling: "pio.stage.compiling",
  linking: "pio.stage.linking",
  uploading: "pio.stage.uploading",
  installing: "pio.stage.installing",
  done: "pio.stage.done",
  failed: "pio.stage.failed",
};

export function BuildToolbar() {
  const { t } = useI18n();
  const kind = useWorkspaceStore((s) => s.kind);
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const info = usePlatformIoStore((s) => s.info);
  const isProject = usePlatformIoStore((s) => s.isProject);
  const envs = usePlatformIoStore((s) => s.envs);
  const selectedEnv = usePlatformIoStore((s) => s.selectedEnv);
  const setSelectedEnv = usePlatformIoStore((s) => s.setSelectedEnv);
  const running = usePlatformIoStore((s) => s.running);
  const progress = usePlatformIoStore((s) => s.progress);
  const error = usePlatformIoStore((s) => s.error);
  const runTask = usePlatformIoStore((s) => s.runTask);
  const uploadPortByRoot = usePlatformIoStore((s) => s.uploadPortByRoot);
  const setUploadPort = usePlatformIoStore((s) => s.setUploadPort);
  const syncUploadPort = usePlatformIoStore((s) => s.syncUploadPort);
  const ports = useSerialStore((s) => s.ports);
  const serialPath = useSerialStore((s) => s.selectedPath);
  const serialConnected = useSerialStore((s) => s.connected);
  const profiles = useFirmwareProfileStore((s) => s.profiles);
  const saveCurrentAs = useFirmwareProfileStore((s) => s.saveCurrentAs);
  const applyProfile = useFirmwareProfileStore((s) => s.applyProfile);
  const showDoctor = usePlatformIoStore((s) => s.showDoctor);
  const runDoctor = usePlatformIoStore((s) => s.runDoctor);
  const flashNotice = useSettingsStore((s) => s.flashNotice);

  const selectedPort =
    (rootPath && uploadPortByRoot[rootPath]) || serialPath || "";

  useEffect(() => {
    if (kind === "folder" && isProject) {
      void syncUploadPort();
    }
  }, [kind, isProject, rootPath, syncUploadPort]);

  if (kind !== "folder" || !isProject) {
    return null;
  }

  const disabled = running || !info?.installed;
  const uploadDisabled = disabled || !selectedPort;
  const showProgress =
    running ||
    progress.stage === "done" ||
    progress.stage === "failed";
  const stageKey = STAGE_KEYS[progress.stage];
  const stageText = stageKey ? t(stageKey) : "";

  const uploadTip = !selectedPort
    ? t("pio.uploadNeedPort")
    : serialConnected
      ? t("pio.uploadWillDisconnect")
      : t("hints.tip.upload");

  return (
    <div className="flex shrink-0 flex-col border-b border-aether-border bg-aether-activity">
      <div
        data-aether-chrome
        className="flex h-8 items-center gap-1 px-2"
      >
      <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-aether-fg-dim">
        PlatformIO
      </span>

      <span className="mr-0.5 text-[10px] text-aether-fg-dim">{t("pio.env")}</span>
      {envs.length > 0 ? (
        <select
          value={selectedEnv}
          disabled={running}
          onChange={(event) => setSelectedEnv(event.target.value)}
          className="h-6 max-w-[160px] rounded border border-aether-border bg-aether-bg px-1 text-[11px] text-aether-fg outline-none focus:border-aether-accent"
          aria-label={t("pio.envSwitch")}
          title={t("pio.envSwitchTitle")}
        >
          {envs.map((env) => (
            <option key={env} value={env}>
              {env}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-[11px] text-aether-fg-dim">{t("pio.envNone")}</span>
      )}

      <span className="ml-1 mr-0.5 text-[10px] text-aether-fg-dim">
        {t("pio.port")}
      </span>
      <div className="flex items-center gap-0.5">
        <select
          value={selectedPort}
          disabled={running}
          onChange={(event) => setUploadPort(event.target.value)}
          className="h-6 max-w-[130px] rounded border border-aether-border bg-aether-bg px-1 text-[11px] text-aether-fg outline-none focus:border-aether-accent"
          aria-label={t("pio.port")}
          title={t("pio.portTitle")}
        >
          <option value="">{t("pio.portNone")}</option>
          {ports.map((port) => (
            <option key={port.path} value={port.path}>
              {port.path}
              {port.name && port.name !== port.path ? ` · ${port.name}` : ""}
            </option>
          ))}
        </select>
        <Tooltip content={t("hints.tip.portRefresh")} side="bottom">
          <button
            type="button"
            aria-label={t("pio.portRefresh")}
            disabled={running}
            onClick={() => {
              void syncUploadPort();
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg disabled:opacity-40"
          >
            <RefreshCw size={12} />
          </button>
        </Tooltip>
      </div>

      <Tooltip content={t("hints.tip.build")} side="bottom">
        <button
          type="button"
          aria-label={t("pio.build")}
          disabled={disabled}
          onClick={() => {
            void runTask("build");
          }}
          className={cn(
            "flex h-6 items-center gap-1 rounded px-2 text-[11px] text-aether-fg",
            "hover:bg-aether-surface-raised disabled:opacity-40",
          )}
        >
          <Hammer size={13} />
          {t("pio.build")}
        </button>
      </Tooltip>

      <Tooltip content={uploadTip} side="bottom">
        <button
          type="button"
          aria-label={t("pio.upload")}
          disabled={uploadDisabled}
          onClick={() => {
            void runTask("upload");
          }}
          className={cn(
            "flex h-6 items-center gap-1 rounded px-2 text-[11px] text-aether-fg",
            "hover:bg-aether-surface-raised disabled:opacity-40",
          )}
        >
          {running && progress.stage === "uploading" ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Upload size={13} />
          )}
          {t("pio.upload")}
        </button>
      </Tooltip>

      <Tooltip content={t("hints.tip.clean")} side="bottom">
        <button
          type="button"
          aria-label={t("pio.clean")}
          disabled={disabled}
          onClick={() => {
            void runTask("clean");
          }}
          className={cn(
            "flex h-6 items-center gap-1 rounded px-2 text-[11px] text-aether-fg-muted",
            "hover:bg-aether-surface-raised hover:text-aether-fg disabled:opacity-40",
          )}
        >
          <Trash2 size={13} />
          {t("pio.clean")}
        </button>
      </Tooltip>

      <Tooltip content={t("hints.tip.compiledb")} side="bottom">
        <button
          type="button"
          aria-label={t("pio.compiledb")}
          disabled={disabled}
          onClick={() => {
            void runTask("compiledb");
          }}
          className={cn(
            "flex h-6 items-center gap-1 rounded px-2 text-[11px] text-aether-fg-muted",
            "hover:bg-aether-surface-raised hover:text-aether-fg disabled:opacity-40",
          )}
        >
          <FileCode2 size={13} />
          {t("pio.compiledb")}
        </button>
      </Tooltip>

      <button
        type="button"
        title={t("profiles.saveCurrentTitle")}
        aria-label={t("profiles.saveCurrent")}
        disabled={running}
        onClick={() => {
          const defaultName =
            (selectedEnv || "env") +
            (selectedPort ? ` · ${selectedPort}` : "");
          const name = window.prompt(t("profiles.namePlaceholder"), defaultName);
          if (!name?.trim()) return;
          const id = saveCurrentAs(name.trim());
          if (!id) {
            flashNotice(t("profiles.needProject"));
            return;
          }
          flashNotice(t("profiles.saved", { name: name.trim() }));
        }}
        className={cn(
          "flex h-6 items-center gap-1 rounded px-2 text-[11px] text-aether-fg-muted",
          "hover:bg-aether-surface-raised hover:text-aether-fg disabled:opacity-40",
        )}
      >
        <BookmarkPlus size={13} />
        {t("profiles.saveCurrentShort")}
      </button>

      {profiles.length > 0 && (
        <select
          value=""
          disabled={running}
          onChange={(event) => {
            const id = event.target.value;
            if (id) void applyProfile(id);
            event.target.value = "";
          }}
          className="h-6 max-w-[140px] rounded border border-aether-border bg-aether-bg px-1 text-[11px] text-aether-fg outline-none focus:border-aether-accent disabled:opacity-40"
          aria-label={t("profiles.apply")}
          title={t("profiles.applyTitle")}
        >
          <option value="">{t("profiles.applySelect")}</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}

      <button
        type="button"
        title={t("doctor.openTitle")}
        aria-label={t("doctor.title")}
        disabled={running}
        onClick={() => {
          showDoctor();
          void runDoctor();
        }}
        className={cn(
          "flex h-6 items-center gap-1 rounded px-2 text-[11px] text-aether-fg-muted",
          "hover:bg-aether-surface-raised hover:text-aether-fg disabled:opacity-40",
        )}
      >
        <Stethoscope size={13} />
        {t("doctor.openShort")}
      </button>

      {showProgress && stageText && (
        <span
          className={cn(
            "ml-1 flex min-w-0 max-w-[220px] items-center gap-1 truncate text-[11px]",
            progress.stage === "failed"
              ? "text-aether-danger"
              : progress.stage === "done"
                ? "text-aether-accent"
                : "text-aether-fg-muted",
          )}
          title={error || progress.detail || stageText}
        >
          {running && <Loader2 size={11} className="shrink-0 animate-spin" />}
          {stageText}
          {progress.percent != null ? ` ${progress.percent}%` : ""}
        </span>
      )}

      {!info?.installed && (
        <span className="ml-2 text-[11px] text-aether-warning">
          {t("pio.missing")}
        </span>
      )}
      </div>
      <PanelHint messageKey="hints.panel.build" className="mx-2 mb-1.5 mt-0.5" />
    </div>
  );
}
