import { useState } from "react";
import { BookOpen, Code2, FolderOpen, PackagePlus } from "lucide-react";
import { CircuitBackground } from "@/components/welcome/CircuitBackground";
import { NewProjectDialog } from "@/components/explorer/NewProjectDialog";
import { OpenExamplesDialog } from "@/components/explorer/OpenExamplesDialog";
import { useI18n } from "@/hooks/useI18n";
import { errorMessage } from "@/lib/errors";
import { isTauriRuntime } from "@/lib/tauri";
import {
  generateVsCodeConfig,
  openInVsCode,
  vscodeErrorKey,
} from "@/lib/vscodeIntegration";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function WelcomeView() {
  const { t } = useI18n();
  const openFolder = useWorkspaceStore((s) => s.openFolder);
  const openDemoWorkspace = useWorkspaceStore((s) => s.openDemoWorkspace);
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const error = useWorkspaceStore((s) => s.error);
  const flashNotice = useSettingsStore((s) => s.flashNotice);
  const tauri = isTauriRuntime();
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [vscodeBusy, setVscodeBusy] = useState(false);

  const runOpenVsCode = async () => {
    if (!tauri) {
      flashNotice(t("vscode.needDesktop"));
      return;
    }
    const folder = rootPath;
    if (!folder) {
      flashNotice(t("vscode.needFolder"));
      return;
    }
    setVscodeBusy(true);
    try {
      await openInVsCode(folder);
      flashNotice(t("vscode.opened"));
    } catch (err) {
      flashNotice(t(vscodeErrorKey(err)));
    } finally {
      setVscodeBusy(false);
    }
  };

  const runGenerateVsCode = async () => {
    if (!tauri) {
      flashNotice(t("vscode.needDesktop"));
      return;
    }
    const folder = rootPath;
    if (!folder) {
      flashNotice(t("vscode.needFolder"));
      return;
    }
    setVscodeBusy(true);
    try {
      const result = await generateVsCodeConfig(folder, {
        confirmOverwrite: (rel) =>
          window.confirm(t("vscode.overwriteConfirm", { file: rel })),
      });
      const parts = [
        ...result.created.map((f) => t("vscode.created", { file: f })),
        ...result.merged.map((f) => t("vscode.merged", { file: f })),
        ...result.skipped.map((f) => t("vscode.skipped", { file: f })),
      ];
      flashNotice(
        parts.length > 0 ? parts.join(" · ") : t("vscode.generateDone"),
      );
    } catch (err) {
      flashNotice(errorMessage(err, t("vscode.generateFailed")));
    } finally {
      setVscodeBusy(false);
    }
  };

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden">
      <CircuitBackground />
      <NewProjectDialog
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
      />
      <OpenExamplesDialog
        open={examplesOpen}
        onClose={() => setExamplesOpen(false)}
      />
      <div className="relative z-10 max-w-md px-8 text-center">
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
            className="flex w-64 items-center justify-center gap-2 rounded border border-aether-border bg-aether-surface/90 px-3 py-2.5 text-xs text-aether-fg backdrop-blur-sm transition-colors hover:border-aether-border-subtle hover:bg-aether-surface-raised"
          >
            <PackagePlus size={14} />
            {t("welcome.newProject")}
          </button>
          <button
            type="button"
            onClick={() => {
              void openFolder();
            }}
            className="flex w-64 items-center justify-center gap-2 rounded border border-aether-border bg-aether-surface/90 px-3 py-2.5 text-xs text-aether-fg backdrop-blur-sm transition-colors hover:border-aether-border-subtle hover:bg-aether-surface-raised"
          >
            <FolderOpen size={14} />
            {t("welcome.openFolder")}
          </button>
          <button
            type="button"
            onClick={() => setExamplesOpen(true)}
            className="flex w-64 items-center justify-center gap-2 rounded border border-aether-border bg-aether-surface/90 px-3 py-2.5 text-xs text-aether-fg backdrop-blur-sm transition-colors hover:border-aether-border-subtle hover:bg-aether-surface-raised"
          >
            <BookOpen size={14} />
            {t("welcome.openExample")}
          </button>
          {tauri ? (
            <button
              type="button"
              disabled={vscodeBusy}
              onClick={() => void runOpenVsCode()}
              className="flex w-64 items-center justify-center gap-2 rounded border border-aether-border bg-aether-surface/90 px-3 py-2.5 text-xs text-aether-fg backdrop-blur-sm transition-colors hover:border-aether-border-subtle hover:bg-aether-surface-raised disabled:opacity-40"
            >
              <Code2 size={14} />
              {t("welcome.openInVsCode")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={openDemoWorkspace}
            className="w-64 rounded border border-transparent px-3 py-2 text-xs text-aether-fg-muted transition-colors hover:text-aether-fg"
          >
            {t("welcome.openDemo")}
          </button>
          {tauri ? (
            <button
              type="button"
              disabled={vscodeBusy}
              onClick={() => void runGenerateVsCode()}
              className="w-64 rounded border border-transparent px-3 py-1.5 text-[11px] text-aether-fg-dim transition-colors hover:text-aether-fg-muted disabled:opacity-40"
            >
              {t("welcome.generateVsCode")}
            </button>
          ) : null}
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
