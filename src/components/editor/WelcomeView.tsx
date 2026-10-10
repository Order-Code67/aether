import { useState } from "react";
import { BookOpen, Code2, FolderOpen, PackagePlus, Rocket } from "lucide-react";
import { CircuitBackground } from "@/components/welcome/CircuitBackground";
import { NewProjectDialog } from "@/components/explorer/NewProjectDialog";
import { OpenExamplesDialog } from "@/components/explorer/OpenExamplesDialog";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { useI18n } from "@/hooks/useI18n";
import { errorMessage } from "@/lib/errors";
import { cn } from "@/lib/cn";
import { isTauriRuntime } from "@/lib/tauri";
import {
  formatGenerateSummary,
  generateVsCodeConfig,
  notifyVsCodeFailure,
  openInVsCode,
  vscodeErrorKey,
  VSCODE_NOTICE_MS,
} from "@/lib/vscodeIntegration";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

async function ensureWorkspaceFolder(): Promise<string | null> {
  const current = useWorkspaceStore.getState().rootPath;
  if (current) return current;
  await useWorkspaceStore.getState().openFolder();
  return useWorkspaceStore.getState().rootPath;
}

export function WelcomeView() {
  const { t } = useI18n();
  const openFolder = useWorkspaceStore((s) => s.openFolder);
  const openDemoWorkspace = useWorkspaceStore((s) => s.openDemoWorkspace);
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const error = useWorkspaceStore((s) => s.error);
  const flashNotice = useSettingsStore((s) => s.flashNotice);
  const arduinoMode = useSettingsStore((s) => s.arduinoMode);
  const tauri = isTauriRuntime();
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [vscodeBusy, setVscodeBusy] = useState(false);

  const runOpenVsCode = async () => {
    if (!tauri) {
      notifyVsCodeFailure(t("vscode.needDesktop"));
      return;
    }
    setVscodeBusy(true);
    try {
      const folder = await ensureWorkspaceFolder();
      if (!folder) {
        window.alert(t("vscode.needFolder"));
        flashNotice(t("vscode.needFolder"), VSCODE_NOTICE_MS);
        return;
      }
      await openInVsCode(folder);
      flashNotice(t("vscode.opened"), VSCODE_NOTICE_MS);
    } catch (err) {
      notifyVsCodeFailure(t(vscodeErrorKey(err)));
    } finally {
      setVscodeBusy(false);
    }
  };

  const runGenerateVsCode = async () => {
    if (!tauri) {
      notifyVsCodeFailure(t("vscode.needDesktop"));
      return;
    }
    setVscodeBusy(true);
    try {
      const folder = await ensureWorkspaceFolder();
      if (!folder) {
        window.alert(t("vscode.needFolder"));
        flashNotice(t("vscode.needFolder"), VSCODE_NOTICE_MS);
        return;
      }
      const result = await generateVsCodeConfig(folder);
      const summary = formatGenerateSummary(result, t);
      flashNotice(summary.replace(/\n/g, " · "), VSCODE_NOTICE_MS);
      window.alert(`${t("vscode.generateDone")}\n\n${summary}`);
    } catch (err) {
      notifyVsCodeFailure(errorMessage(err, t("vscode.generateFailed")));
    } finally {
      setVscodeBusy(false);
    }
  };

  const vscodeTitle = rootPath
    ? undefined
    : t("vscode.needFolderHint");

  return (
    <div
      data-testid="welcome-screen"
      className="relative flex flex-1 items-center justify-center overflow-hidden"
    >
      <CircuitBackground />
      <NewProjectDialog
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
      />
      <OpenExamplesDialog
        open={examplesOpen}
        onClose={() => setExamplesOpen(false)}
      />
      <OnboardingWizard
        open={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
      />
      <div className="relative z-10 max-w-md px-8 text-center">
        <p
          data-testid="welcome-brand"
          className={cn(
            "font-light tracking-[0.12em] text-aether-fg",
            arduinoMode ? "text-4xl" : "text-3xl",
          )}
        >
          {t("app.name")}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-aether-fg-muted">
          {t("app.tagline")}
        </p>

        <div className="mt-8 flex flex-col items-center gap-2">
          <button
            type="button"
            data-testid="welcome-quick-start"
            onClick={() => setOnboardingOpen(true)}
            className={cn(
              "flex items-center justify-center gap-2 rounded border border-aether-accent bg-aether-accent text-white backdrop-blur-sm transition-opacity hover:opacity-90",
              arduinoMode
                ? "w-72 px-3 py-3 text-sm"
                : "w-64 px-3 py-2.5 text-xs",
            )}
          >
            <Rocket size={14} />
            {t("welcome.quickStart")}
          </button>
          <button
            type="button"
            data-testid="welcome-new-project"
            onClick={() => setNewProjectOpen(true)}
            className="flex w-64 items-center justify-center gap-2 rounded border border-aether-border bg-aether-surface/90 px-3 py-2.5 text-xs text-aether-fg backdrop-blur-sm transition-colors hover:border-aether-border-subtle hover:bg-aether-surface-raised"
          >
            <PackagePlus size={14} />
            {t("welcome.newProject")}
          </button>
          <button
            type="button"
            data-testid="welcome-open-folder"
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
              title={vscodeTitle}
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
              title={vscodeTitle}
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
