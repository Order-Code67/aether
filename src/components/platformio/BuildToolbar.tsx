import { useEffect } from "react";
import { FileCode2, Hammer, RefreshCw, Trash2, Upload } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useSerialStore } from "@/stores/serialStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

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
  const runTask = usePlatformIoStore((s) => s.runTask);
  const uploadPortByRoot = usePlatformIoStore((s) => s.uploadPortByRoot);
  const setUploadPort = usePlatformIoStore((s) => s.setUploadPort);
  const ports = useSerialStore((s) => s.ports);
  const serialPath = useSerialStore((s) => s.selectedPath);
  const refreshPorts = useSerialStore((s) => s.refreshPorts);

  const selectedPort =
    (rootPath && uploadPortByRoot[rootPath]) || serialPath || "";

  useEffect(() => {
    if (kind === "folder" && isProject) {
      void refreshPorts();
    }
  }, [kind, isProject, rootPath, refreshPorts]);

  if (kind !== "folder" || !isProject) {
    return null;
  }

  const disabled = running || !info?.installed;
  const uploadDisabled = disabled || !selectedPort;

  return (
    <div
      data-aether-chrome
      className="flex h-8 shrink-0 items-center gap-1 border-b border-aether-border bg-aether-activity px-2"
    >
      <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-aether-fg-dim">
        PlatformIO
      </span>

      {envs.length > 0 && (
        <select
          value={selectedEnv}
          disabled={running}
          onChange={(event) => setSelectedEnv(event.target.value)}
          className="h-6 max-w-[140px] rounded border border-aether-border bg-aether-bg px-1 text-[11px] text-aether-fg outline-none focus:border-aether-accent"
          aria-label="PlatformIO environment"
        >
          {envs.map((env) => (
            <option key={env} value={env}>
              {env}
            </option>
          ))}
        </select>
      )}

      <div className="flex items-center gap-0.5">
        <select
          value={selectedPort}
          disabled={running}
          onChange={(event) => setUploadPort(event.target.value)}
          className="h-6 max-w-[130px] rounded border border-aether-border bg-aether-bg px-1 text-[11px] text-aether-fg outline-none focus:border-aether-accent"
          aria-label={t("pio.port")}
          title={t("pio.port")}
        >
          <option value="">{t("pio.portNone")}</option>
          {ports.map((port) => (
            <option key={port.path} value={port.path}>
              {port.path}
              {port.name && port.name !== port.path ? ` · ${port.name}` : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          title={t("pio.portRefresh")}
          aria-label={t("pio.portRefresh")}
          disabled={running}
          onClick={() => {
            void refreshPorts();
          }}
          className="flex h-6 w-6 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg disabled:opacity-40"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      <button
        type="button"
        title="Build (Ctrl+Shift+B)"
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

      <button
        type="button"
        title={
          !selectedPort ? t("pio.uploadNeedPort") : t("pio.upload")
        }
        disabled={uploadDisabled}
        onClick={() => {
          void runTask("upload");
        }}
        className={cn(
          "flex h-6 items-center gap-1 rounded px-2 text-[11px] text-aether-fg",
          "hover:bg-aether-surface-raised disabled:opacity-40",
        )}
      >
        <Upload size={13} />
        {t("pio.upload")}
      </button>

      <button
        type="button"
        title={t("pio.clean")}
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

      <button
        type="button"
        title="Generate compile_commands.json for IntelliSense (pio run -t compiledb)"
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

      {!info?.installed && (
        <span className="ml-2 text-[11px] text-aether-warning">
          {t("pio.missing")}
        </span>
      )}
    </div>
  );
}
