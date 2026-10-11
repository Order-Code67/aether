import { useState } from "react";
import {
  FilePlus,
  FolderMinus,
  FolderOpen,
  FolderPlus,
  Folders,
  FolderX,
  PackagePlus,
  Pin,
} from "lucide-react";
import { AgentPanel } from "@/components/agent/AgentPanel";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { ExtensionsPanel } from "@/components/extensions/ExtensionsPanel";
import { FileTree } from "@/components/explorer/FileTree";
import { NewProjectDialog } from "@/components/explorer/NewProjectDialog";
import { BplaStudioPanel } from "@/components/inav/BplaStudioPanel";
import { LibrariesPanel } from "@/components/libraries/LibrariesPanel";
import { SearchPanel } from "@/components/search/SearchPanel";
import { SourceControlPanel } from "@/components/scm/SourceControlPanel";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import { isTauriRuntime } from "@/lib/tauri";
import { useLayoutStore } from "@/stores/layoutStore";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { ACTIVITY_ITEMS } from "@/types/layout";

function promptName(message: string, initial: string): string | null {
  const value = window.prompt(message, initial);
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function SidebarPlaceholder({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-9 shrink-0 items-center px-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-aether-fg-muted">
          {title}
        </h2>
      </header>
      <div className="aether-scroll flex-1 overflow-auto px-4 pb-4">
        <p className="text-xs leading-relaxed text-aether-fg-dim">{hint}</p>
      </div>
    </div>
  );
}

function ExplorerSidebar() {
  const { t } = useI18n();
  const kind = useWorkspaceStore((s) => s.kind);
  const folders = useWorkspaceStore((s) => s.folders);
  const tree = useWorkspaceStore((s) => s.tree);
  const rootName = useWorkspaceStore((s) => s.rootName);
  const activeFolderPath = useWorkspaceStore((s) => s.activeFolderPath);
  const loading = useWorkspaceStore((s) => s.loading);
  const error = useWorkspaceStore((s) => s.error);
  const openFolder = useWorkspaceStore((s) => s.openFolder);
  const addFolder = useWorkspaceStore((s) => s.addFolder);
  const removeFolder = useWorkspaceStore((s) => s.removeFolder);
  const setActiveFolder = useWorkspaceStore((s) => s.setActiveFolder);
  const openDemoWorkspace = useWorkspaceStore((s) => s.openDemoWorkspace);
  const closeWorkspace = useWorkspaceStore((s) => s.closeWorkspace);
  const createFile = useWorkspaceStore((s) => s.createFile);
  const createFolder = useWorkspaceStore((s) => s.createFolder);
  const isProject = usePlatformIoStore((s) => s.isProject);
  const sketchMode = useSettingsStore((s) => s.sketchMode);
  const showAllFiles = useSettingsStore((s) => s.showAllFiles);
  const setSketchMode = useSettingsStore((s) => s.setSketchMode);
  const setShowAllFiles = useSettingsStore((s) => s.setShowAllFiles);
  const tauri = isTauriRuntime();
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <NewProjectDialog
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
      />
      <header className="flex h-9 shrink-0 items-center justify-between gap-2 px-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-aether-fg-muted">
          {t("explorer.title")}
        </h2>
        <div className="flex items-center gap-0.5">
          {kind === "folder" && isProject && (
            <>
              <button
                type="button"
                title={t("sketch.modeToggle")}
                aria-label={t("sketch.modeToggle")}
                aria-pressed={sketchMode}
                onClick={() => setSketchMode(!sketchMode)}
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-medium",
                  sketchMode
                    ? "bg-aether-accent-muted text-aether-fg"
                    : "text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg",
                )}
              >
                {t("sketch.badge")}
              </button>
              {sketchMode && (
                <button
                  type="button"
                  title={t("sketch.showAll")}
                  aria-label={t("sketch.showAll")}
                  aria-pressed={showAllFiles}
                  onClick={() => setShowAllFiles(!showAllFiles)}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px]",
                    showAllFiles
                      ? "bg-aether-surface-raised text-aether-fg"
                      : "text-aether-fg-dim hover:bg-aether-surface-raised hover:text-aether-fg",
                  )}
                >
                  {showAllFiles ? t("sketch.hideClutter") : t("sketch.showAll")}
                </button>
              )}
            </>
          )}
          {kind === "folder" && activeFolderPath && (
            <>
              <button
                type="button"
                title="New File"
                aria-label="New File"
                onClick={() => {
                  const name = promptName("New file name", "untitled.cpp");
                  if (name) void createFile(activeFolderPath, name);
                }}
                className="flex h-6 w-6 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
              >
                <FilePlus size={14} />
              </button>
              <button
                type="button"
                title="New Folder"
                aria-label="New Folder"
                onClick={() => {
                  const name = promptName("New folder name", "src");
                  if (name) void createFolder(activeFolderPath, name);
                }}
                className="flex h-6 w-6 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
              >
                <FolderPlus size={14} />
              </button>
              <button
                type="button"
                title="Add Folder to Workspace"
                aria-label="Add Folder to Workspace"
                onClick={() => {
                  void addFolder();
                }}
                className="flex h-6 w-6 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
              >
                <Folders size={14} />
              </button>
            </>
          )}
          <button
            type="button"
            title={t("explorer.newProject")}
            aria-label={t("explorer.newProject")}
            onClick={() => setNewProjectOpen(true)}
            className="flex h-6 w-6 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
          >
            <PackagePlus size={14} />
          </button>
          <button
            type="button"
            title="Open Folder"
            aria-label="Open Folder"
            onClick={() => {
              void openFolder();
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
          >
            <FolderOpen size={14} />
          </button>
          {kind !== "none" && (
            <button
              type="button"
              title="Close Workspace"
              aria-label="Close Workspace"
              onClick={closeWorkspace}
              className="flex h-6 w-6 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
            >
              <FolderX size={14} />
            </button>
          )}
        </div>
      </header>

      {kind === "none" ? (
        <div className="flex flex-1 flex-col gap-3 px-4 pb-4">
          <p className="text-xs leading-relaxed text-aether-fg-dim">
            Open a project folder to browse files on disk. You can add more
            roots later for a multi-root workspace.
          </p>
          <button
            type="button"
            onClick={() => setNewProjectOpen(true)}
            className="rounded border border-aether-border bg-aether-bg px-3 py-2 text-left text-xs text-aether-fg transition-colors hover:border-aether-border-subtle hover:bg-aether-surface-raised"
          >
            {t("explorer.newProject")}
          </button>
          <button
            type="button"
            onClick={() => {
              void openFolder();
            }}
            className="rounded border border-aether-border bg-aether-bg px-3 py-2 text-left text-xs text-aether-fg transition-colors hover:border-aether-border-subtle hover:bg-aether-surface-raised"
          >
            Open Folder…
          </button>
          <button
            type="button"
            onClick={openDemoWorkspace}
            className="rounded border border-transparent px-3 py-2 text-left text-xs text-aether-fg-muted transition-colors hover:text-aether-fg"
          >
            Open Demo Workspace
          </button>
          {!tauri && (
            <p className="text-[11px] leading-relaxed text-aether-warning">
              Folder access needs the Tauri app (`npm run tauri:dev`).
            </p>
          )}
          {error && (
            <p className="text-[11px] leading-relaxed text-aether-danger">
              {error}
            </p>
          )}
        </div>
      ) : kind === "demo" ? (
        <>
          <div className="px-4 pb-2">
            <p className="truncate text-[11px] font-medium text-aether-fg">
              {rootName}
            </p>
          </div>
          {loading ? (
            <p className="px-4 text-xs text-aether-fg-dim">Loading…</p>
          ) : (
            <div className="aether-scroll min-h-0 flex-1 overflow-auto pb-3">
              <FileTree nodes={tree} />
            </div>
          )}
          {error && (
            <p className="px-4 pb-3 text-[11px] leading-relaxed text-aether-danger">
              {error}
            </p>
          )}
        </>
      ) : (
        <>
          <div className="px-3 pb-1">
            <p className="truncate text-[11px] text-aether-fg-dim">
              {folders.length === 1
                ? "1 folder"
                : `${folders.length} folders · active for PIO/Terminal`}
            </p>
          </div>
          {loading && (
            <p className="px-4 text-xs text-aether-fg-dim">Loading…</p>
          )}
          <div className="aether-scroll min-h-0 flex-1 overflow-auto pb-3">
            {folders.map((folder) => {
              const isActive = folder.path === activeFolderPath;
              return (
                <div key={folder.path} className="mb-1">
                  <div className="group flex items-center gap-0.5 px-2 py-0.5">
                    <button
                      type="button"
                      title={
                        isActive
                          ? "Active root (PIO / Terminal)"
                          : "Set as active root"
                      }
                      onClick={() => setActiveFolder(folder.path)}
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] font-semibold uppercase tracking-wide",
                        isActive
                          ? "bg-aether-accent-muted text-aether-fg"
                          : "text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg",
                      )}
                    >
                      <Pin
                        size={11}
                        className={cn(
                          "shrink-0",
                          isActive ? "opacity-100" : "opacity-40",
                        )}
                      />
                      <span className="truncate">{folder.name}</span>
                    </button>
                    <button
                      type="button"
                      title="Remove folder from workspace"
                      aria-label={`Remove ${folder.name}`}
                      onClick={() => removeFolder(folder.path)}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-aether-fg-dim opacity-0 hover:bg-aether-surface-raised hover:text-aether-fg group-hover:opacity-100"
                    >
                      <FolderMinus size={12} />
                    </button>
                  </div>
                  <FileTree nodes={folder.tree} rootPath={folder.path} />
                </div>
              );
            })}
          </div>
          {error && (
            <p className="px-4 pb-3 text-[11px] leading-relaxed text-aether-danger">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}

const SIDEBAR_CONTENT: Record<string, { title: string; hint: string }> = {};

function BoardsSidebar() {
  const { t } = useI18n();
  const info = usePlatformIoStore((s) => s.info);
  const isProject = usePlatformIoStore((s) => s.isProject);
  const envs = usePlatformIoStore((s) => s.envs);
  const selectedEnv = usePlatformIoStore((s) => s.selectedEnv);
  const setSelectedEnv = usePlatformIoStore((s) => s.setSelectedEnv);
  const running = usePlatformIoStore((s) => s.running);
  const runTask = usePlatformIoStore((s) => s.runTask);
  const refreshCli = usePlatformIoStore((s) => s.refreshCli);
  const refreshProject = usePlatformIoStore((s) => s.refreshProject);
  const folders = useWorkspaceStore((s) => s.folders);
  const activeFolderPath = useWorkspaceStore((s) => s.activeFolderPath);
  const setActiveFolder = useWorkspaceStore((s) => s.setActiveFolder);
  const rootName = useWorkspaceStore((s) => s.rootName);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-9 shrink-0 items-center justify-between px-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-aether-fg-muted">
          {t("boards.title")}
        </h2>
        <button
          type="button"
          className="text-[11px] text-aether-fg-muted hover:text-aether-fg"
          onClick={() => {
            void refreshCli();
            void refreshProject();
          }}
        >
          {t("common.refresh")}
        </button>
      </header>
      <div className="aether-scroll flex-1 space-y-3 overflow-auto px-3 pb-4 text-xs">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-aether-fg-dim">
            PlatformIO CLI
          </p>
          <p className="text-aether-fg">
            {info?.installed
              ? info.version || "Installed"
              : "Not found on PATH"}
          </p>
        </div>

        {folders.length > 1 && (
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-aether-fg-dim">
              Active project root
            </p>
            <div className="space-y-0.5">
              {folders.map((folder) => (
                <button
                  key={folder.path}
                  type="button"
                  onClick={() => setActiveFolder(folder.path)}
                  className={cn(
                    "flex w-full rounded px-2 py-1 text-left hover:bg-aether-surface-raised",
                    activeFolderPath === folder.path
                      ? "bg-aether-accent-muted text-aether-fg"
                      : "text-aether-fg",
                  )}
                >
                  {folder.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {!isProject ? (
          <p className="text-aether-fg-dim">
            {t("boards.noIni")} ({rootName})
          </p>
        ) : (
          <>
            <div>
              <p className="mb-1 text-[11px] uppercase tracking-wide text-aether-fg-dim">
                {t("boards.environments")}
              </p>
              <div className="space-y-0.5">
                {envs.length === 0 ? (
                  <p className="text-aether-fg-dim">{t("boards.noEnvs")}</p>
                ) : (
                  envs.map((env) => (
                    <button
                      key={env}
                      type="button"
                      onClick={() => setSelectedEnv(env)}
                      className={cn(
                        "flex w-full rounded px-2 py-1 text-left hover:bg-aether-surface-raised",
                        selectedEnv === env
                          ? "bg-aether-accent-muted text-aether-fg"
                          : "text-aether-fg",
                      )}
                    >
                      {env}
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                disabled={running || !info?.installed}
                onClick={() => {
                  void runTask("build");
                }}
                className="rounded border border-aether-border px-2 py-1.5 text-left text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
              >
                {t("boards.build")}
              </button>
              <button
                type="button"
                disabled={running || !info?.installed}
                onClick={() => {
                  void runTask("upload");
                }}
                className="rounded border border-aether-border px-2 py-1.5 text-left text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
              >
                {t("boards.upload")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function Sidebar() {
  const { t } = useI18n();
  const activeActivity = useLayoutStore((s) => s.activeActivity);
  const sidebarVisible = useLayoutStore((s) => s.sidebarVisible);
  const sidebarWidth = useLayoutStore((s) => s.sidebarWidth);

  if (!sidebarVisible) {
    return null;
  }

  const activityItem = ACTIVITY_ITEMS.find(
    (item) => item.id === activeActivity,
  );
  const activityLabel = activityItem
    ? t(activityItem.labelKey)
    : "Sidebar";

  return (
    <aside
      className="flex h-full shrink-0 flex-col bg-aether-surface"
      style={{ width: sidebarWidth }}
      aria-label={activityLabel}
    >
      <div
        key={activeActivity}
        className="flex min-h-0 flex-1 flex-col animate-[aetherPanelIn_160ms_ease-out]"
      >
        {activeActivity === "explorer" ? (
          <ExplorerSidebar />
        ) : activeActivity === "search" ? (
          <SearchPanel />
        ) : activeActivity === "source-control" ? (
          <SourceControlPanel />
        ) : activeActivity === "boards" ? (
          <BoardsSidebar />
        ) : activeActivity === "libraries" ? (
          <LibrariesPanel />
        ) : activeActivity === "inav" ? (
          <BplaStudioPanel />
        ) : activeActivity === "debug" ? (
          <DebugPanel />
        ) : activeActivity === "agent" ? (
          <AgentPanel />
        ) : activeActivity === "extensions" ? (
          <ExtensionsPanel />
        ) : (
          <SidebarPlaceholder
            title={SIDEBAR_CONTENT[activeActivity]?.title ?? activityLabel}
            hint={
              SIDEBAR_CONTENT[activeActivity]?.hint ??
              "This panel is reserved for a future feature."
            }
          />
        )}
      </div>
    </aside>
  );
}
