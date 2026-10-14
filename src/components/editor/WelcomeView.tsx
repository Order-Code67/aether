import { useState } from "react";
import {
  Bot,
  Code2,
  Cpu,
  FolderOpen,
  Navigation,
  PackagePlus,
  Rocket,
} from "lucide-react";
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
import { useLayoutStore } from "@/stores/layoutStore";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

async function ensureWorkspaceFolder(): Promise<string | null> {
  const current = useWorkspaceStore.getState().rootPath;
  if (current) return current;
  await useWorkspaceStore.getState().openFolder();
  return useWorkspaceStore.getState().rootPath;
}

type HubId = "arduino" | "platformio" | "inav" | "vscode" | "ai";

export function WelcomeView() {
  const { t } = useI18n();
  const openFolder = useWorkspaceStore((s) => s.openFolder);
  const openDemoWorkspace = useWorkspaceStore((s) => s.openDemoWorkspace);
  const error = useWorkspaceStore((s) => s.error);
  const flashNotice = useSettingsStore((s) => s.flashNotice);
  const openSettings = useSettingsStore((s) => s.openSettings);
  const showDoctor = usePlatformIoStore((s) => s.showDoctor);
  const setActiveActivity = useLayoutStore((s) => s.setActiveActivity);
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

  const onHub = (id: HubId) => {
    switch (id) {
      case "arduino":
        setOnboardingOpen(true);
        break;
      case "platformio":
        void openFolder();
        setActiveActivity("boards");
        break;
      case "inav":
        setActiveActivity("inav");
        break;
      case "vscode":
        void runOpenVsCode();
        break;
      case "ai":
        setActiveActivity("agent");
        break;
    }
  };

  const modules: {
    id: HubId;
    icon: typeof Rocket;
    titleKey: "hub.arduino" | "hub.platformio" | "hub.inav" | "hub.vscode" | "hub.ai";
    descKey:
      | "hub.arduinoDesc"
      | "hub.platformioDesc"
      | "hub.inavDesc"
      | "hub.vscodeDesc"
      | "hub.aiDesc";
    tipKey:
      | "hub.arduinoTitle"
      | "hub.platformioTitle"
      | "hub.inavTitle"
      | "hub.vscodeTitle"
      | "hub.aiTitle";
    testId: string;
  }[] = [
    {
      id: "arduino",
      icon: Rocket,
      titleKey: "hub.arduino",
      descKey: "hub.arduinoDesc",
      tipKey: "hub.arduinoTitle",
      testId: "hub-arduino",
    },
    {
      id: "platformio",
      icon: Cpu,
      titleKey: "hub.platformio",
      descKey: "hub.platformioDesc",
      tipKey: "hub.platformioTitle",
      testId: "hub-platformio",
    },
    {
      id: "inav",
      icon: Navigation,
      titleKey: "hub.inav",
      descKey: "hub.inavDesc",
      tipKey: "hub.inavTitle",
      testId: "hub-inav",
    },
    {
      id: "vscode",
      icon: Code2,
      titleKey: "hub.vscode",
      descKey: "hub.vscodeDesc",
      tipKey: "hub.vscodeTitle",
      testId: "hub-vscode",
    },
    {
      id: "ai",
      icon: Bot,
      titleKey: "hub.ai",
      descKey: "hub.aiDesc",
      tipKey: "hub.aiTitle",
      testId: "hub-ai",
    },
  ];

  return (
    <div
      data-testid="welcome-screen"
      className="relative flex flex-1 items-center justify-center overflow-hidden"
    >
      <CircuitBackground />
      {/* Subtle hub watermark — neon cyan on dark, not purple-on-white */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1] opacity-[0.07]"
        style={{
          backgroundImage: "url(/aether-icon.png)",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center 42%",
          backgroundSize: "min(52vmin, 420px)",
          filter: "saturate(1.2) brightness(1.1)",
        }}
      />
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
      <div className="relative z-10 w-full max-w-3xl px-6 py-8 text-center">
        <p
          data-testid="welcome-brand"
          className="text-4xl font-light tracking-[0.14em] text-aether-fg"
        >
          {t("app.name")}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-aether-fg-muted">
          {t("hub.tagline")}
        </p>

        <p
          className="mx-auto mt-3 max-w-xl text-[11px] leading-relaxed text-aether-fg-dim"
          data-testid="welcome-clean-pc"
          title={t("welcome.cleanPcHint")}
        >
          {t("welcome.cleanPcHint")}
        </p>

        <div
          className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          data-testid="welcome-hub"
        >
          {modules.map((mod, index) => {
            const Icon = mod.icon;
            const wide = index === 0 || index === 1;
            return (
              <button
                key={mod.id}
                type="button"
                data-testid={mod.testId}
                title={t(mod.tipKey)}
                aria-label={t(mod.titleKey)}
                disabled={mod.id === "vscode" && vscodeBusy}
                onClick={() => onHub(mod.id)}
                className={cn(
                  "group relative flex min-h-[108px] flex-col items-start justify-between overflow-hidden rounded-lg border border-aether-border/80 bg-aether-surface/75 px-4 py-3 text-left backdrop-blur-sm transition-all duration-200",
                  "hover:border-aether-accent/70 hover:bg-aether-surface-raised/90 hover:shadow-[0_0_24px_-8px_rgba(34,211,238,0.35)]",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-aether-accent",
                  wide && "sm:col-span-1",
                  mod.id === "ai" && "sm:col-span-2 lg:col-span-1",
                )}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full bg-cyan-400/5 transition-transform duration-300 group-hover:scale-125"
                />
                <Icon
                  size={22}
                  className="text-cyan-300/90 transition-transform duration-200 group-hover:scale-110"
                />
                <div className="mt-3 w-full">
                  <p className="text-sm font-medium tracking-wide text-aether-fg">
                    {t(mod.titleKey)}
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-aether-fg-dim">
                    {t(mod.descKey)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            data-testid="welcome-quick-start"
            title={t("welcome.quickStartTitle")}
            aria-label={t("welcome.quickStart")}
            onClick={() => setOnboardingOpen(true)}
            className="flex items-center gap-1.5 rounded border border-transparent px-2 py-1 text-[11px] text-aether-fg-muted hover:text-aether-fg"
          >
            <Rocket size={12} />
            {t("welcome.quickStart")}
          </button>
          {tauri ? (
            <button
              type="button"
              data-testid="welcome-clean-pc-btn"
              title={t("welcome.cleanPcHint")}
              aria-label={t("welcome.cleanPc")}
              onClick={() => {
                showDoctor();
                openSettings("tools");
              }}
              className="rounded border border-transparent px-2 py-1 text-[11px] text-aether-fg-muted hover:text-aether-fg"
            >
              {t("welcome.cleanPc")}
            </button>
          ) : null}
          <button
            type="button"
            data-testid="welcome-new-project"
            title={t("welcome.newProjectTitle")}
            aria-label={t("welcome.newProject")}
            onClick={() => setNewProjectOpen(true)}
            className="flex items-center gap-1.5 rounded border border-transparent px-2 py-1 text-[11px] text-aether-fg-muted hover:text-aether-fg"
          >
            <PackagePlus size={12} />
            {t("welcome.newProject")}
          </button>
          <button
            type="button"
            data-testid="welcome-open-folder"
            title={t("welcome.openFolderTitle")}
            aria-label={t("welcome.openFolder")}
            onClick={() => {
              void openFolder();
            }}
            className="flex items-center gap-1.5 rounded border border-transparent px-2 py-1 text-[11px] text-aether-fg-muted hover:text-aether-fg"
          >
            <FolderOpen size={12} />
            {t("welcome.openFolder")}
          </button>
          <button
            type="button"
            title={t("welcome.openExampleTitle")}
            aria-label={t("welcome.openExample")}
            onClick={() => setExamplesOpen(true)}
            className="rounded border border-transparent px-2 py-1 text-[11px] text-aether-fg-muted hover:text-aether-fg"
          >
            {t("welcome.openExample")}
          </button>
          <button
            type="button"
            title={t("welcome.openDemoTitle")}
            aria-label={t("welcome.openDemo")}
            onClick={openDemoWorkspace}
            className="rounded border border-transparent px-2 py-1 text-[11px] text-aether-fg-dim hover:text-aether-fg-muted"
          >
            {t("welcome.openDemo")}
          </button>
          {tauri ? (
            <button
              type="button"
              title={t("welcome.generateVsCodeTitle")}
              aria-label={t("welcome.generateVsCode")}
              disabled={vscodeBusy}
              onClick={() => void runGenerateVsCode()}
              className="rounded border border-transparent px-2 py-1 text-[11px] text-aether-fg-dim hover:text-aether-fg-muted disabled:opacity-40"
            >
              {t("welcome.generateVsCode")}
            </button>
          ) : null}
        </div>

        {!tauri && (
          <p className="mt-4 text-[11px] leading-relaxed text-aether-fg-dim">
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
