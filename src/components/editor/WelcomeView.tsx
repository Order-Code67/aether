import { useState } from "react";
import { FolderOpen, PackagePlus } from "lucide-react";
import { NewProjectDialog } from "@/components/explorer/NewProjectDialog";
import { isTauriRuntime } from "@/lib/tauri";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function WelcomeView() {
  const openFolder = useWorkspaceStore((s) => s.openFolder);
  const openDemoWorkspace = useWorkspaceStore((s) => s.openDemoWorkspace);
  const error = useWorkspaceStore((s) => s.error);
  const tauri = isTauriRuntime();
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  return (
    <div className="relative flex flex-1 items-center justify-center">
      <NewProjectDialog
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
      />
      <div className="max-w-md px-8 text-center">
        <p className="text-3xl font-light tracking-[0.12em] text-aether-fg">
          Aether
        </p>
        <p className="mt-3 text-sm leading-relaxed text-aether-fg-muted">
          IDE for robots, drones, and embedded systems.
        </p>

        <div className="mt-8 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => setNewProjectOpen(true)}
            className="flex w-64 items-center justify-center gap-2 rounded border border-aether-border bg-aether-surface px-3 py-2.5 text-xs text-aether-fg transition-colors hover:border-aether-border-subtle hover:bg-aether-surface-raised"
          >
            <PackagePlus size={14} />
            New PlatformIO Project…
          </button>
          <button
            type="button"
            onClick={() => {
              void openFolder();
            }}
            className="flex w-64 items-center justify-center gap-2 rounded border border-aether-border bg-aether-surface px-3 py-2.5 text-xs text-aether-fg transition-colors hover:border-aether-border-subtle hover:bg-aether-surface-raised"
          >
            <FolderOpen size={14} />
            Open Folder…
          </button>
          <button
            type="button"
            onClick={openDemoWorkspace}
            className="w-64 rounded border border-transparent px-3 py-2 text-xs text-aether-fg-muted transition-colors hover:text-aether-fg"
          >
            Open Demo Workspace
          </button>
        </div>

        {!tauri && (
          <p className="mt-6 text-[11px] leading-relaxed text-aether-fg-dim">
            Browser preview can use the demo workspace.
            <br />
            Real folders require{" "}
            <span className="font-mono text-aether-fg-muted">
              npm run tauri:dev
            </span>
            .
          </p>
        )}

        {error && (
          <p className="mt-4 text-[11px] leading-relaxed text-aether-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
