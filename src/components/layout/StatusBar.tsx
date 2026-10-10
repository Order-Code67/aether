import {
  AlertCircle,
  AlertTriangle,
  BrainCircuit,
  Bug,
  Folder,
  GitBranch,
  Radio,
  Wifi,
} from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { languageLabel, tabNameFromPath } from "@/types/editor";
import { useDebugStore } from "@/stores/debugStore";
import { useEditorStore } from "@/stores/editorStore";
import { useLayoutStore } from "@/stores/layoutStore";
import { useLspStore } from "@/stores/lspStore";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useProblemsStore } from "@/stores/problemsStore";
import { useScmStore } from "@/stores/scmStore";
import { useSerialStore } from "@/stores/serialStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function StatusBar() {
  const { t } = useI18n();
  const cursor = useEditorStore((s) => s.cursor);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const notice = useSettingsStore((s) => s.notice);
  const activeTab = useEditorStore((s) => {
    const id = s.activeTabId;
    return s.tabs.find((tab) => tab.id === id) ?? null;
  });
  const rootName = useWorkspaceStore((s) => s.rootName);
  const kind = useWorkspaceStore((s) => s.kind);
  const folderCount = useWorkspaceStore((s) => s.folders.length);
  const serialConnected = useSerialStore((s) => s.connected);
  const serialPath = useSerialStore((s) => s.selectedPath);
  const serialBaud = useSerialStore((s) => s.baudRate);
  const setBottomPanelTab = useLayoutStore((s) => s.setBottomPanelTab);
  const pioInstalled = usePlatformIoStore((s) => s.info?.installed ?? false);
  const isProject = usePlatformIoStore((s) => s.isProject);
  const running = usePlatformIoStore((s) => s.running);
  const lastSuccess = usePlatformIoStore((s) => s.lastSuccess);
  const progress = usePlatformIoStore((s) => s.progress);
  const selectedEnv = usePlatformIoStore((s) => s.selectedEnv);
  const uploadPortByRoot = usePlatformIoStore((s) => s.uploadPortByRoot);
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const uploadPort =
    (rootPath && uploadPortByRoot[rootPath]) || serialPath || "";
  const problems = useProblemsStore((s) => s.problems);
  const errorCount = problems.filter((p) => p.severity === "error").length;
  const warningCount = problems.filter((p) => p.severity === "warning").length;
  const gitBranch = useScmStore((s) => s.status?.branch ?? null);
  const gitIsRepo = useScmStore((s) => s.status?.isRepo ?? false);
  const gitChanges = useScmStore((s) => {
    const st = s.status;
    if (!st) return 0;
    return (
      st.staged.length +
      st.unstaged.length +
      st.untracked.length +
      (st.unmerged?.length ?? 0)
    );
  });
  const gitConflicts = useScmStore((s) => s.status?.unmerged?.length ?? 0);
  const setActiveActivity = useLayoutStore((s) => s.setActiveActivity);
  const lspInfo = useLspStore((s) => s.info);
  const lspRunning = useLspStore((s) => s.status.running);
  const lspInitializing = useLspStore((s) => s.initializing);
  const lspCompileDir = useLspStore((s) => s.status.compileCommandsDir);
  const lspError = useLspStore((s) => s.error);
  const debugActive = useDebugStore((s) => s.sessionActive);
  const debugState = useDebugStore((s) => s.execState);

  let saveLabel: string | null = null;
  if (saveStatus.kind === "saving") {
    saveLabel = t("status.saving");
  } else if (saveStatus.kind === "saved") {
    saveLabel = t("status.saved", { name: tabNameFromPath(saveStatus.path) });
  } else if (saveStatus.kind === "error") {
    saveLabel = saveStatus.message;
  }

  let pioLabel = t("pio.none");
  if (!pioInstalled) pioLabel = t("pio.missing");
  else if (running) {
    const stageKey =
      progress.stage === "compiling"
        ? "pio.stage.compiling"
        : progress.stage === "linking"
          ? "pio.stage.linking"
          : progress.stage === "uploading"
            ? "pio.stage.uploading"
            : progress.stage === "installing"
              ? "pio.stage.installing"
              : null;
    const stage = stageKey ? t(stageKey) : t("pio.running");
    pioLabel =
      progress.percent != null ? `${stage} ${progress.percent}%` : stage;
  } else if (isProject) {
    const boardPort = [
      selectedEnv || t("pio.board"),
      uploadPort || t("pio.portNone"),
    ].join(" · ");
    pioLabel =
      lastSuccess === false
        ? `${t("pio.failed")} · ${boardPort}`
        : `${t("pio.ok")} · ${boardPort}`;
  } else if (kind === "folder") {
    pioLabel = "No platformio.ini";
  }

  let clangdLabel = t("status.clangd");
  let clangdTitle = "IntelliSense (clangd)";
  if (!lspInfo?.installed) {
    clangdLabel = t("status.clangdMissing");
    clangdTitle = "Install LLVM/clangd and ensure it is on PATH";
  } else if (lspError) {
    clangdLabel = "clangd error";
    clangdTitle = lspError;
  } else if (lspInitializing) {
    clangdLabel = t("status.clangdInit");
    clangdTitle = "Starting language server";
  } else if (lspRunning) {
    clangdLabel = lspCompileDir
      ? t("status.clangd")
      : `${t("status.clangd")} · ${t("status.clangdNoDb")}`;
    clangdTitle = lspCompileDir
      ? `clangd · compile_commands: ${lspCompileDir}`
      : "clangd running without compile_commands.json — run PlatformIO → IntelliSense DB";
  } else if (kind === "folder") {
    clangdLabel = t("status.clangdOff");
  }

  return (
    <footer
      className="flex h-statusbar shrink-0 items-center justify-between bg-aether-status px-2 text-[11px] text-white"
      aria-label="Status Bar"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="font-medium tracking-wide">{t("app.name")}</span>
        <button
          type="button"
          title="Open Problems"
          onClick={() => setBottomPanelTab("problems")}
          className="flex items-center gap-1 opacity-90 hover:opacity-100"
        >
          <AlertCircle size={12} />
          {errorCount}
        </button>
        <button
          type="button"
          title="Open Problems"
          onClick={() => setBottomPanelTab("problems")}
          className="flex items-center gap-1 opacity-90 hover:opacity-100"
        >
          <AlertTriangle size={12} />
          {warningCount}
        </button>
        {kind !== "none" && (
          <span
            className="flex max-w-[200px] items-center gap-1 truncate opacity-90"
            title={
              folderCount > 1
                ? `${folderCount} workspace folders · active: ${rootName}`
                : rootName
            }
          >
            <Folder size={12} />
            {rootName}
          </span>
        )}
        {gitIsRepo && gitBranch && (
          <button
            type="button"
            title="Open Source Control"
            onClick={() => setActiveActivity("source-control")}
            className="flex max-w-[140px] items-center gap-1 truncate opacity-90 hover:opacity-100"
          >
            <GitBranch size={12} />
            {gitBranch}
            {gitConflicts > 0
              ? ` · ${gitConflicts}!`
              : gitChanges > 0
                ? ` · ${gitChanges}`
                : ""}
          </button>
        )}
        <button
          type="button"
          title={
            isProject
              ? `${t("pio.board")}: ${selectedEnv || "—"} · ${t("pio.port")}: ${uploadPort || t("pio.portNone")}`
              : "Open PlatformIO Output"
          }
          onClick={() => setBottomPanelTab("output")}
          className="truncate opacity-90 hover:opacity-100"
        >
          {pioLabel}
        </button>
        {kind === "folder" && (
          <span
            className="flex max-w-[160px] items-center gap-1 truncate opacity-90"
            title={clangdTitle}
          >
            <BrainCircuit size={12} />
            {clangdLabel}
          </span>
        )}
        {debugActive && (
          <button
            type="button"
            title="Open Run and Debug"
            onClick={() => setActiveActivity("debug")}
            className="flex items-center gap-1 opacity-90 hover:opacity-100"
          >
            <Bug size={12} />
            {debugState}
          </button>
        )}
        {saveLabel && (
          <span
            className={
              saveStatus.kind === "error"
                ? "truncate text-amber-200"
                : "truncate opacity-95"
            }
            title={saveLabel}
          >
            {saveLabel}
          </span>
        )}
        {notice && (
          <span className="truncate opacity-95" title={notice}>
            {notice}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3 opacity-95">
        <button
          type="button"
          title="Open Serial Monitor"
          onClick={() => setBottomPanelTab("serial")}
          className="flex items-center gap-1 hover:opacity-100"
        >
          <Radio size={12} />
          {serialConnected
            ? `${serialPath || "Serial"} @ ${serialBaud}`
            : uploadPort || (isProject ? t("pio.portNone") : "No board")}
        </button>
        <span className="flex items-center gap-1">
          <Wifi size={12} />
          {serialConnected ? "Serial" : "Disconnected"}
        </span>
        {activeTab && <span>{languageLabel(activeTab.language)}</span>}
        <span>UTF-8</span>
        <span>
          {t("status.lnCol", {
            line: cursor.lineNumber,
            col: cursor.column,
          })}
        </span>
      </div>
    </footer>
  );
}
