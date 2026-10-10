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
import { languageLabel, tabNameFromPath } from "@/types/editor";
import { useDebugStore } from "@/stores/debugStore";
import { useEditorStore } from "@/stores/editorStore";
import { useLayoutStore } from "@/stores/layoutStore";
import { useLspStore } from "@/stores/lspStore";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useProblemsStore } from "@/stores/problemsStore";
import { useScmStore } from "@/stores/scmStore";
import { useSerialStore } from "@/stores/serialStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function StatusBar() {
  const cursor = useEditorStore((s) => s.cursor);
  const saveStatus = useEditorStore((s) => s.saveStatus);
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
  const selectedEnv = usePlatformIoStore((s) => s.selectedEnv);
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
    saveLabel = "Saving…";
  } else if (saveStatus.kind === "saved") {
    saveLabel = `Saved ${tabNameFromPath(saveStatus.path)}`;
  } else if (saveStatus.kind === "error") {
    saveLabel = saveStatus.message;
  }

  let pioLabel = "No PIO";
  if (!pioInstalled) pioLabel = "PIO missing";
  else if (running) pioLabel = "PIO running…";
  else if (isProject) {
    pioLabel =
      lastSuccess === false
        ? `PIO · ${selectedEnv || "env"} · fail`
        : `PIO · ${selectedEnv || "project"}`;
  } else if (kind === "folder") {
    pioLabel = "No platformio.ini";
  }

  let clangdLabel = "clangd";
  let clangdTitle = "IntelliSense (clangd)";
  if (!lspInfo?.installed) {
    clangdLabel = "No clangd";
    clangdTitle = "Install LLVM/clangd and ensure it is on PATH";
  } else if (lspError) {
    clangdLabel = "clangd error";
    clangdTitle = lspError;
  } else if (lspInitializing) {
    clangdLabel = "clangd…";
    clangdTitle = "Starting language server";
  } else if (lspRunning) {
    clangdLabel = lspCompileDir ? "clangd" : "clangd · no DB";
    clangdTitle = lspCompileDir
      ? `clangd · compile_commands: ${lspCompileDir}`
      : "clangd running without compile_commands.json — run PlatformIO → IntelliSense DB";
  } else if (kind === "folder") {
    clangdLabel = "clangd off";
  }

  return (
    <footer
      className="flex h-statusbar shrink-0 items-center justify-between bg-aether-status px-2 text-[11px] text-white"
      aria-label="Status Bar"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="font-medium tracking-wide">Aether</span>
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
          title="Open PlatformIO Output"
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
            : "No board"}
        </button>
        <span className="flex items-center gap-1">
          <Wifi size={12} />
          {serialConnected ? "Serial" : "Disconnected"}
        </span>
        {activeTab && <span>{languageLabel(activeTab.language)}</span>}
        <span>UTF-8</span>
        <span>
          Ln {cursor.lineNumber}, Col {cursor.column}
        </span>
      </div>
    </footer>
  );
}
