import { useState } from "react";
import { BookOpen, FolderOpen, PackagePlus } from "lucide-react";
import { NewProjectDialog } from "@/components/explorer/NewProjectDialog";
import { OpenExamplesDialog } from "@/components/explorer/OpenExamplesDialog";
import { useI18n } from "@/hooks/useI18n";
import { isTauriRuntime } from "@/lib/tauri";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function WelcomeView() {
  const { t } = useI18n();
  const openFolder = useWorkspaceStore((s) => s.openFolder);
  const openDemoWorkspace = useWorkspaceStore((s) => s.openDemoWorkspace);
  const error = useWorkspaceStore((s) => s.error);
  const tauri = isTauriRuntime();
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [examplesOpen, setExamplesOpen] = useState(false);

  return (
    <div className="relative flex flex-1 items-center justify-center">
      <NewProjectDialog
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
      />
      <OpenExamplesDialog
        open={examplesOpen}
        onClose={() => setExamplesOpen(false)}
      />
      <div className="max-w-md px-8 text-center">
        <p className="text-3xl font-light tracking-[0.12em] text-aether-fg">
          {t("app.name")}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-aether-fg-muted">
          {t("app.tagline")}
        </p>

        <div className="mt-8 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => setNewProjectOpen(true)}
            className="flex w-64 items-center justify-center gap-2 rounded border border-aether-border bg-aether-surface px-3 py-2.5 text-xs text-aether-fg transition-colors hover:border-aether-border-subtle hover:bg-aether-surface-raised"
          >
            <PackagePlus size={14} />
            {t("welcome.newProject")}
          </button>
          <button
            type="button"
            onClick={() => {
              void openFolder();
            }}
            className="flex w-64 items-center justify-center gap-2 rounded border border-aether-border bg-aether-surface px-3 py-2.5 text-xs text-aether-fg transition-colors hover:border-aether-border-subtle hover:bg-aether-surface-raised"
          >
            <FolderOpen size={14} />
            {t("welcome.openFolder")}
          </button>
          <button
            type="button"
            onClick={() => setExamplesOpen(true)}
            className="flex w-64 items-center justify-center gap-2 rounded border border-aether-border bg-aether-surface px-3 py-2.5 text-xs text-aether-fg transition-colors hover:border-aether-border-subtle hover:bg-aether-surface-raised"
          >
            <BookOpen size={14} />
            {t("welcome.openExample")}
          </button>
          <button
            type="button"
            onClick={openDemoWorkspace}
            className="w-64 rounded border border-transparent px-3 py-2 text-xs text-aether-fg-muted transition-colors hover:text-aether-fg"
          >
            {t("welcome.openDemo")}
          </button>
        </div>

        {!tauri && (
          <p className="mt-6 text-[11px] leading-relaxed text-aether-fg-dim">
            {t("welcome.browserHint")}
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
