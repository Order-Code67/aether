import { useEffect, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Loader2,
  Navigation,
  Radio,
  RefreshCw,
  Rocket,
  Upload,
  X,
} from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import { materializeBundledExample } from "@/lib/examples";
import { pickParentFolder } from "@/lib/fsWorkspace";
import { openLoraTxRxPair } from "@/lib/loraPair";
import { friendlyPioError } from "@/lib/pioErrors";
import { initPioProject } from "@/lib/platformio";
import { isTauriRuntime } from "@/lib/tauri";
import { useLayoutStore } from "@/stores/layoutStore";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useSerialStore } from "@/stores/serialStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

type OnboardBoard = {
  id: string;
  labelKey:
    | "wizard.board.esp32"
    | "wizard.board.mega"
    | "wizard.board.nano"
    | "wizard.board.esp32cam";
  blinkExampleId: string;
  servoExampleId: string;
  starters: Array<"blink" | "servo">;
};

const BOARDS: OnboardBoard[] = [
  {
    id: "esp32dev",
    labelKey: "wizard.board.esp32",
    blinkExampleId: "esp32-blink",
    servoExampleId: "esp32-blink",
    starters: ["blink"],
  },
  {
    id: "megaatmega2560",
    labelKey: "wizard.board.mega",
    blinkExampleId: "arduino-mega-servo",
    servoExampleId: "arduino-mega-servo",
    starters: ["blink", "servo"],
  },
  {
    id: "nanoatmega328",
    labelKey: "wizard.board.nano",
    blinkExampleId: "arduino-nano",
    servoExampleId: "arduino-nano",
    starters: ["blink", "servo"],
  },
  {
    id: "esp32cam",
    labelKey: "wizard.board.esp32cam",
    blinkExampleId: "esp32-cam",
    servoExampleId: "esp32-cam",
    starters: ["blink"],
  },
];

type TourPage = "blink" | "lora" | "configurator";
type BlinkStepId = "board" | "port" | "project" | "upload";

const TOUR_PAGES: TourPage[] = ["blink", "lora", "configurator"];

interface OnboardingWizardProps {
  open: boolean;
  onClose: () => void;
}

export function OnboardingWizard({ open, onClose }: OnboardingWizardProps) {
  const { t, locale } = useI18n();
  const setOnboardingDone = useSettingsStore((s) => s.setOnboardingDone);
  const openFolderAt = useWorkspaceStore((s) => s.openFolderAt);
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const isProject = usePlatformIoStore((s) => s.isProject);
  const refreshProject = usePlatformIoStore((s) => s.refreshProject);
  const runTask = usePlatformIoStore((s) => s.runTask);
  const running = usePlatformIoStore((s) => s.running);
  const pioError = usePlatformIoStore((s) => s.error);
  const setUploadPort = usePlatformIoStore((s) => s.setUploadPort);
  const uploadPortByRoot = usePlatformIoStore((s) => s.uploadPortByRoot);
  const syncUploadPort = usePlatformIoStore((s) => s.syncUploadPort);
  const ports = useSerialStore((s) => s.ports);
  const refreshPorts = useSerialStore((s) => s.refreshPorts);
  const setSelectedPath = useSerialStore((s) => s.setSelectedPath);
  const setBottomPanelTab = useLayoutStore((s) => s.setBottomPanelTab);
  const setActiveActivity = useLayoutStore((s) => s.setActiveActivity);
  const flashNotice = useSettingsStore((s) => s.flashNotice);

  const [page, setPage] = useState<TourPage>("blink");
  const [boardId, setBoardId] = useState("esp32dev");
  const [starter, setStarter] = useState<"blink" | "servo">("blink");
  const [port, setPort] = useState("");
  const [busy, setBusy] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [projectReady, setProjectReady] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [pairBusy, setPairBusy] = useState(false);

  const board = BOARDS.find((b) => b.id === boardId) ?? BOARDS[0]!;
  const effectiveStarter: "blink" | "servo" = board.starters.includes(starter)
    ? starter
    : "blink";
  const pageIndex = TOUR_PAGES.indexOf(page);

  useEffect(() => {
    if (!open) return;
    setPage("blink");
    setStepError(null);
    setBusy(false);
    setUploadDone(false);
    setProjectReady(Boolean(rootPath && isProject));
    if (isTauriRuntime()) {
      void refreshPorts().then(() => {
        void syncUploadPort().then((picked) => {
          if (picked) setPort(picked);
        });
      });
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        e.preventDefault();
        setOnboardingDone(true);
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, busy, onClose, setOnboardingDone]);

  useEffect(() => {
    if (rootPath && isProject) setProjectReady(true);
  }, [rootPath, isProject]);

  useEffect(() => {
    if (rootPath && uploadPortByRoot[rootPath] && !port) {
      setPort(uploadPortByRoot[rootPath]!);
    }
  }, [rootPath, uploadPortByRoot, port]);

  if (!open) return null;

  const boardDone = Boolean(boardId);
  const portDone = Boolean(port);
  const projectDone = projectReady && Boolean(rootPath && isProject);
  const uploadStepDone = uploadDone;

  const blinkSteps: { id: BlinkStepId; done: boolean; label: string }[] = [
    { id: "board", done: boardDone, label: t("onboarding.step.board") },
    { id: "port", done: portDone, label: t("onboarding.step.port") },
    { id: "project", done: projectDone, label: t("onboarding.step.project") },
    { id: "upload", done: uploadStepDone, label: t("onboarding.step.upload") },
  ];

  const dismiss = (completed: boolean) => {
    setOnboardingDone(true);
    if (completed) {
      flashNotice(t("onboarding.completedNotice"), 3200);
    }
    onClose();
  };

  const selectPort = (path: string) => {
    setPort(path);
    setSelectedPath(path);
    setUploadPort(path);
    setStepError(null);
  };

  const createStarterProject = async () => {
    if (!isTauriRuntime()) {
      setStepError(t("onboarding.needDesktop"));
      return;
    }
    setBusy(true);
    setStepError(null);
    try {
      const parent = await pickParentFolder(t("wizard.parent"));
      if (!parent) {
        setBusy(false);
        return;
      }
      const name =
        effectiveStarter === "servo" ? "servo_starter" : "blink_starter";
      const path = await initPioProject({
        parent,
        name,
        board: board.id,
        framework: "arduino",
        starter: effectiveStarter,
      });
      await openFolderAt(path);
      await refreshProject();
      setProjectReady(true);
    } catch (err) {
      setStepError(
        friendlyPioError(
          err instanceof Error ? err.message : t("wizard.error"),
          locale,
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  const openStarterExample = async () => {
    if (!isTauriRuntime()) {
      setStepError(t("onboarding.needDesktop"));
      return;
    }
    setBusy(true);
    setStepError(null);
    try {
      const exampleId =
        effectiveStarter === "servo"
          ? board.servoExampleId
          : board.blinkExampleId;
      const path = await materializeBundledExample(exampleId);
      await openFolderAt(path);
      await refreshProject();
      setProjectReady(true);
    } catch (err) {
      setStepError(
        err instanceof Error ? err.message : t("onboarding.projectFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  const runBuildUpload = async () => {
    if (!projectDone) {
      setStepError(t("onboarding.needProject"));
      return;
    }
    if (!port) {
      setStepError(t("onboarding.needPort"));
      return;
    }
    setBusy(true);
    setStepError(null);
    setUploadPort(port);
    setSelectedPath(port);
    setBottomPanelTab("output");
    try {
      await runTask("upload");
      const err = usePlatformIoStore.getState().error;
      const ok = usePlatformIoStore.getState().lastSuccess;
      if (ok) {
        setUploadDone(true);
      } else if (err) {
        setStepError(err);
      } else if (pioError) {
        setStepError(pioError);
      }
    } catch (err) {
      setStepError(
        friendlyPioError(
          err instanceof Error ? err.message : t("common.error"),
          locale,
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  const openLoraPair = async () => {
    if (!isTauriRuntime()) {
      flashNotice(t("onboarding.needDesktop"), 3000);
      return;
    }
    setPairBusy(true);
    try {
      await openLoraTxRxPair();
      flashNotice(t("onboarding.lora.opened"), 4000);
      setActiveActivity("boards");
    } catch (e) {
      flashNotice(
        e instanceof Error ? e.message : t("onboarding.lora.failed"),
        4000,
      );
    } finally {
      setPairBusy(false);
    }
  };

  const goConfigurator = () => {
    setActiveActivity("inav");
    flashNotice(t("onboarding.configurator.opened"), 3200);
    dismiss(true);
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[8vh]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) dismiss(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("onboarding.title")}
        data-aether-chrome
        data-testid="onboarding-wizard"
        className="flex w-full max-w-lg flex-col overflow-hidden rounded border border-aether-border bg-aether-surface shadow-2xl"
      >
        <header className="flex h-10 shrink-0 items-center justify-between border-b border-aether-border px-3">
          <div>
            <h2 className="text-sm font-medium text-aether-fg">
              {t("onboarding.title")}
            </h2>
            <p className="text-[11px] text-aether-fg-dim">
              {t("onboarding.subtitle")}
            </p>
          </div>
          <button
            type="button"
            title={t("onboarding.skipTitle")}
            aria-label={t("onboarding.skip")}
            disabled={busy}
            onClick={() => dismiss(false)}
            className="flex h-7 w-7 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </header>

        <nav
          className="flex gap-1 border-b border-aether-border px-3 py-2"
          aria-label={t("onboarding.tourNav")}
        >
          {TOUR_PAGES.map((id, i) => {
            const label =
              id === "blink"
                ? t("onboarding.tour.blink")
                : id === "lora"
                  ? t("onboarding.tour.lora")
                  : t("onboarding.tour.configurator");
            const active = page === id;
            const done = i < pageIndex;
            return (
              <button
                key={id}
                type="button"
                data-testid={`onboarding-tour-${id}`}
                disabled={busy}
                onClick={() => {
                  setPage(id);
                  setStepError(null);
                }}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 rounded border px-1.5 py-1.5 text-[11px]",
                  active
                    ? "border-aether-accent bg-aether-accent-muted text-aether-fg"
                    : done
                      ? "border-aether-success/40 text-aether-success"
                      : "border-aether-border text-aether-fg-muted hover:text-aether-fg",
                )}
              >
                {done ? <Check size={11} /> : <span>{i + 1}</span>}
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex max-h-[70vh] flex-col gap-4 overflow-auto px-4 py-4">
          {page === "blink" && (
            <>
              <p className="text-[11px] leading-relaxed text-aether-fg-muted">
                {t("onboarding.tour.blinkBody")}
              </p>
              <ol className="space-y-1.5">
                {blinkSteps.map((s, i) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-2 text-xs text-aether-fg"
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full border text-[10px]",
                        s.done
                          ? "border-aether-success bg-aether-success/20 text-aether-success"
                          : "border-aether-border text-aether-fg-dim",
                      )}
                    >
                      {s.done ? <Check size={12} /> : i + 1}
                    </span>
                    {s.label}
                  </li>
                ))}
              </ol>

              <section className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-aether-fg-muted">
                  {t("onboarding.step.board")}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {BOARDS.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      title={t("onboarding.boardTitle")}
                      aria-label={t(b.labelKey)}
                      disabled={busy}
                      onClick={() => {
                        setBoardId(b.id);
                        if (!b.starters.includes(starter)) setStarter("blink");
                        setStepError(null);
                      }}
                      className={cn(
                        "rounded border px-2 py-2 text-left text-xs",
                        boardId === b.id
                          ? "border-aether-accent bg-aether-accent-muted text-aether-fg"
                          : "border-aether-border text-aether-fg-muted hover:border-aether-accent hover:text-aether-fg",
                      )}
                    >
                      {t(b.labelKey)}
                    </button>
                  ))}
                </div>
                {board.starters.length > 1 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {board.starters.map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={busy}
                        onClick={() => setStarter(s)}
                        className={cn(
                          "rounded border px-2 py-1 text-[11px]",
                          effectiveStarter === s
                            ? "border-aether-accent bg-aether-accent-muted text-aether-fg"
                            : "border-aether-border text-aether-fg-muted hover:text-aether-fg",
                        )}
                      >
                        {s === "servo"
                          ? t("wizard.starter.servo")
                          : t("wizard.starter.blink")}
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-aether-fg-muted">
                    {t("onboarding.step.port")}
                  </p>
                  <button
                    type="button"
                    title={t("onboarding.portRefreshTitle")}
                    aria-label={t("pio.portRefresh")}
                    disabled={busy || !isTauriRuntime()}
                    onClick={() => {
                      void refreshPorts().then(() => void syncUploadPort());
                    }}
                    className="inline-flex items-center gap-1 rounded border border-aether-border px-2 py-0.5 text-[11px] text-aether-fg-muted hover:text-aether-fg disabled:opacity-40"
                  >
                    <RefreshCw size={11} />
                    {t("pio.portRefresh")}
                  </button>
                </div>
                {ports.length === 0 ? (
                  <p className="text-[11px] text-aether-fg-dim">
                    {t("onboarding.noPorts")}
                  </p>
                ) : (
                  <select
                    value={port}
                    disabled={busy}
                    onChange={(e) => selectPort(e.target.value)}
                    title={t("onboarding.portTitle")}
                    aria-label={t("onboarding.portTitle")}
                    className="h-8 w-full rounded border border-aether-border bg-aether-bg px-2 text-xs text-aether-fg outline-none focus:border-aether-accent"
                  >
                    <option value="">{t("pio.portNone")}</option>
                    {ports.map((p) => (
                      <option key={p.path} value={p.path}>
                        {p.path}
                        {p.name && p.name !== p.path ? ` · ${p.name}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </section>

              <section className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-aether-fg-muted">
                  {t("onboarding.step.project")}
                </p>
                <p className="text-[11px] leading-relaxed text-aether-fg-dim">
                  {projectDone
                    ? t("onboarding.projectReady", {
                        path: rootPath ?? "",
                      })
                    : t("onboarding.projectHint")}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    title={t("onboarding.createBlinkTitle")}
                    aria-label={
                      effectiveStarter === "servo"
                        ? t("onboarding.createServo")
                        : t("onboarding.createBlink")
                    }
                    disabled={busy}
                    onClick={() => void createStarterProject()}
                    className="inline-flex items-center gap-1 rounded border border-aether-accent bg-aether-accent px-2.5 py-1.5 text-[11px] text-white disabled:opacity-40"
                  >
                    {busy ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <FolderOpen size={12} />
                    )}
                    {effectiveStarter === "servo"
                      ? t("onboarding.createServo")
                      : t("onboarding.createBlink")}
                  </button>
                  <button
                    type="button"
                    title={t("onboarding.openExampleTitle")}
                    aria-label={t("onboarding.openExample")}
                    disabled={busy}
                    onClick={() => void openStarterExample()}
                    className="inline-flex items-center gap-1 rounded border border-aether-border px-2.5 py-1.5 text-[11px] text-aether-fg hover:border-aether-accent disabled:opacity-40"
                  >
                    {t("onboarding.openExample")}
                  </button>
                </div>
              </section>

              <section className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-aether-fg-muted">
                  {t("onboarding.step.upload")}
                </p>
                <p className="text-[11px] leading-relaxed text-aether-fg-dim">
                  {t("onboarding.uploadHint")}
                </p>
                <button
                  type="button"
                  title={t("onboarding.buildUploadTitle")}
                  aria-label={t("onboarding.buildUpload")}
                  disabled={busy || running || !projectDone || !port}
                  onClick={() => void runBuildUpload()}
                  className="inline-flex items-center gap-1 rounded border border-aether-accent bg-aether-accent px-2.5 py-1.5 text-[11px] text-white disabled:opacity-40"
                >
                  {busy || running ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Upload size={12} />
                  )}
                  {t("onboarding.buildUpload")}
                </button>
              </section>
            </>
          )}

          {page === "lora" && (
            <section className="space-y-3 text-left" data-testid="onboarding-lora">
              <div className="flex items-start gap-2">
                <Radio size={18} className="mt-0.5 shrink-0 text-cyan-300/90" />
                <div>
                  <p className="text-sm font-medium text-aether-fg">
                    {t("onboarding.tour.lora")}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-aether-fg-muted">
                    {t("onboarding.tour.loraBody")}
                  </p>
                </div>
              </div>
              <ul className="list-inside list-disc space-y-1 text-[11px] text-aether-fg-dim">
                <li>{t("hints.checklist.lora.step1")}</li>
                <li>{t("hints.checklist.lora.step3")}</li>
                <li>{t("hints.checklist.lora.step4")}</li>
              </ul>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="onboarding-lora-pair"
                  title={t("onboarding.lora.ctaTitle")}
                  aria-label={t("onboarding.lora.cta")}
                  disabled={pairBusy}
                  onClick={() => void openLoraPair()}
                  className="inline-flex items-center gap-1 rounded border border-aether-accent bg-aether-accent px-2.5 py-1.5 text-[11px] text-white disabled:opacity-40"
                >
                  {pairBusy ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Radio size={12} />
                  )}
                  {t("onboarding.lora.cta")}
                </button>
                <button
                  type="button"
                  title={t("onboarding.lora.guideTitle")}
                  aria-label={t("onboarding.lora.guide")}
                  onClick={() => {
                    setActiveActivity("boards");
                    flashNotice(t("onboarding.lora.guideHint"), 4000);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1 rounded border border-aether-border px-2.5 py-1.5 text-[11px] text-aether-fg hover:border-aether-accent"
                >
                  {t("onboarding.lora.guide")}
                </button>
              </div>
            </section>
          )}

          {page === "configurator" && (
            <section
              className="space-y-3 text-left"
              data-testid="onboarding-configurator"
            >
              <div className="flex items-start gap-2">
                <Navigation
                  size={18}
                  className="mt-0.5 shrink-0 text-cyan-300/90"
                />
                <div>
                  <p className="text-sm font-medium text-aether-fg">
                    {t("onboarding.tour.configurator")}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-aether-fg-muted">
                    {t("onboarding.tour.configuratorBody")}
                  </p>
                </div>
              </div>
              <ul className="list-inside list-disc space-y-1 text-[11px] text-aether-fg-dim">
                <li>{t("hints.checklist.bpla.step1")}</li>
                <li>{t("hints.checklist.bpla.step2")}</li>
                <li>{t("hints.checklist.bpla.step3")}</li>
              </ul>
              <button
                type="button"
                data-testid="onboarding-configurator-cta"
                title={t("onboarding.configurator.ctaTitle")}
                aria-label={t("onboarding.configurator.cta")}
                onClick={goConfigurator}
                className="inline-flex items-center gap-1 rounded border border-aether-accent bg-aether-accent px-2.5 py-1.5 text-[11px] text-white"
              >
                <Rocket size={12} />
                {t("onboarding.configurator.cta")}
              </button>
            </section>
          )}

          {stepError && (
            <p
              role="alert"
              className="rounded border border-aether-danger/40 bg-aether-danger/10 px-2 py-1.5 text-[11px] leading-relaxed text-aether-danger"
            >
              {stepError}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-aether-border px-3 py-2">
          <button
            type="button"
            title={t("onboarding.skipTitle")}
            aria-label={t("onboarding.skip")}
            disabled={busy}
            onClick={() => dismiss(false)}
            className="rounded px-2 py-1 text-[11px] text-aether-fg-muted hover:text-aether-fg disabled:opacity-40"
          >
            {t("onboarding.skip")}
          </button>
          <div className="flex items-center gap-1.5">
            {pageIndex > 0 && (
              <button
                type="button"
                data-testid="onboarding-back"
                disabled={busy}
                onClick={() => {
                  setPage(TOUR_PAGES[pageIndex - 1]!);
                  setStepError(null);
                }}
                className="inline-flex items-center gap-0.5 rounded border border-aether-border px-2 py-1 text-[11px] text-aether-fg-muted hover:text-aether-fg disabled:opacity-40"
              >
                <ChevronLeft size={12} />
                {t("onboarding.back")}
              </button>
            )}
            {pageIndex < TOUR_PAGES.length - 1 ? (
              <button
                type="button"
                data-testid="onboarding-next"
                disabled={busy}
                onClick={() => {
                  setPage(TOUR_PAGES[pageIndex + 1]!);
                  setStepError(null);
                }}
                className="inline-flex items-center gap-0.5 rounded border border-aether-accent bg-aether-accent px-2.5 py-1 text-[11px] text-white disabled:opacity-40"
              >
                {t("onboarding.next")}
                <ChevronRight size={12} />
              </button>
            ) : (
              <button
                type="button"
                title={t("onboarding.finishTitle")}
                aria-label={t("onboarding.finish")}
                onClick={() => dismiss(true)}
                className="rounded border border-aether-accent bg-aether-accent px-2.5 py-1 text-[11px] text-white"
              >
                {t("onboarding.finish")}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
