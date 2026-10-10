import { create } from "zustand";
import { persist } from "zustand/middleware";
import { t } from "@/hooks/useI18n";
import { friendlyPioError } from "@/lib/pioErrors";
import {
  advancePioProgress,
  emptyPioProgress,
  type PioProgress,
} from "@/lib/pioProgress";
import {
  cancelPioTask,
  detectPio,
  detectPython,
  installPioCore,
  inspectPioProject,
  runPioTask,
  type PioInfo,
  type PioOutputPayload,
  type PioStatusPayload,
  type PioTask,
  type PythonInfo,
} from "@/lib/platformio";
import { lspDetect, type LspInfo } from "@/lib/lsp";
import { isTauriRuntime } from "@/lib/tauri";
import { useLayoutStore } from "@/stores/layoutStore";
import { useProblemsStore } from "@/stores/problemsStore";
import { useSerialStore } from "@/stores/serialStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

const MAX_LINES = 4000;

export interface OutputLine {
  id: number;
  stream: string;
  text: string;
}

export interface DoctorReport {
  checking: boolean;
  checked: boolean;
  installing: boolean;
  installError: string | null;
  pio: PioInfo | null;
  python: PythonInfo | null;
  clangd: LspInfo | null;
  /** True when PlatformIO CLI is present (clangd/python tips are optional). */
  ok: boolean;
}

interface PlatformIoState {
  info: PioInfo | null;
  isProject: boolean;
  envs: string[];
  selectedEnv: string;
  /** Upload port preference keyed by workspace root (falls back to serial selection). */
  uploadPortByRoot: Record<string, string>;
  running: boolean;
  lastTask: PioTask | null;
  lastSuccess: boolean | null;
  lines: OutputLine[];
  error: string | null;
  lineSeq: number;
  progress: PioProgress;
  doctor: DoctorReport;
  doctorDismissed: boolean;
  refreshCli: () => Promise<void>;
  refreshProject: () => Promise<void>;
  setSelectedEnv: (env: string) => void;
  setUploadPort: (port: string) => void;
  getUploadPort: () => string;
  appendOutput: (payload: PioOutputPayload) => void;
  applyStatus: (status: PioStatusPayload) => void;
  clearOutput: () => void;
  runTask: (task: PioTask) => Promise<void>;
  cancel: () => Promise<void>;
  runDoctor: () => Promise<void>;
  installMissing: () => Promise<void>;
  dismissDoctor: () => void;
  showDoctor: () => void;
}

function localizeError(message: string): string {
  const locale = useSettingsStore.getState().locale;
  return friendlyPioError(message, locale);
}

export const usePlatformIoStore = create<PlatformIoState>()(
  persist(
    (set, get) => ({
      info: null,
      isProject: false,
      envs: [],
      selectedEnv: "",
      uploadPortByRoot: {},
      running: false,
      lastTask: null,
      lastSuccess: null,
      lines: [],
      error: null,
      lineSeq: 0,
      progress: emptyPioProgress(),
      doctor: {
        checking: false,
        checked: false,
        installing: false,
        installError: null,
        pio: null,
        python: null,
        clangd: null,
        ok: true,
      },
      doctorDismissed: false,

      refreshCli: async () => {
        if (!isTauriRuntime()) {
          set({
            info: { installed: false, command: null, version: null },
            error: null,
          });
          return;
        }
        try {
          const info = await detectPio();
          set({ info, error: null });
        } catch (error) {
          set({
            error: localizeError(
              error instanceof Error
                ? error.message
                : "Failed to detect PlatformIO.",
            ),
          });
        }
      },

      refreshProject: async () => {
        const { kind, rootPath } = useWorkspaceStore.getState();
        if (kind !== "folder" || !rootPath) {
          set({ isProject: false, envs: [], selectedEnv: "" });
          return;
        }

        if (!isTauriRuntime()) {
          set({ isProject: false, envs: [] });
          return;
        }

        try {
          const project = await inspectPioProject(rootPath);
          set((state) => {
            const stillSelected = project.envs.includes(state.selectedEnv);
            return {
              isProject: project.isProject,
              envs: project.envs,
              selectedEnv: stillSelected
                ? state.selectedEnv
                : (project.envs[0] ?? ""),
              error: null,
            };
          });
        } catch (error) {
          set({
            isProject: false,
            error: localizeError(
              error instanceof Error
                ? error.message
                : "Failed to inspect PlatformIO project.",
            ),
          });
        }
      },

      setSelectedEnv: (env) => set({ selectedEnv: env }),

      setUploadPort: (port) => {
        const { rootPath } = useWorkspaceStore.getState();
        useSerialStore.getState().setSelectedPath(port);
        if (!rootPath) return;
        set((state) => ({
          uploadPortByRoot: { ...state.uploadPortByRoot, [rootPath]: port },
        }));
      },

      getUploadPort: () => {
        const { rootPath } = useWorkspaceStore.getState();
        const byRoot = rootPath
          ? get().uploadPortByRoot[rootPath]
          : undefined;
        if (byRoot) return byRoot;
        return useSerialStore.getState().selectedPath;
      },

      appendOutput: (payload) => {
        if (payload.stream === "stdout" || payload.stream === "stderr") {
          useProblemsStore.getState().ingestLine(payload.line);
        }
        set((state) => {
          const nextId = state.lineSeq + 1;
          const lines = [
            ...state.lines,
            { id: nextId, stream: payload.stream, text: payload.line },
          ];
          return {
            lineSeq: nextId,
            lines:
              lines.length > MAX_LINES
                ? lines.slice(lines.length - MAX_LINES)
                : lines,
            progress: advancePioProgress(
              state.progress,
              payload.line,
              payload.stream,
            ),
          };
        });
      },

      applyStatus: (status) => {
        let nextError = status.error ? localizeError(status.error) : null;
        if (
          !status.running &&
          status.success === false &&
          !nextError &&
          (status.task === "upload" ||
            status.task === "build" ||
            status.task === "install-core")
        ) {
          const recent = get()
            .lines.slice(-40)
            .map((l) => l.text)
            .join("\n");
          nextError = localizeError(
            recent ||
              (status.task === "install-core"
                ? "PlatformIO install failed."
                : "Upload failed. Check the selected COM port and board."),
          );
        }

        const task = (status.task as PioTask | null) ?? get().lastTask;
        let progress = get().progress;
        if (status.running) {
          progress = {
            stage:
              task === "install-core"
                ? "installing"
                : progress.stage === "idle"
                  ? "starting"
                  : progress.stage,
            percent: progress.percent,
            detail: progress.detail,
          };
        } else if (status.success === true) {
          progress = { stage: "done", percent: 100, detail: progress.detail };
        } else if (status.success === false) {
          progress = {
            stage: "failed",
            percent: progress.percent,
            detail: progress.detail,
          };
        } else {
          progress = emptyPioProgress();
        }

        set({
          running: status.running,
          lastTask: task,
          lastSuccess: status.success,
          error: nextError,
          progress,
        });

        if (status.task === "install-core" && !status.running) {
          set((state) => ({
            doctor: {
              ...state.doctor,
              installing: false,
              installError:
                status.success === false
                  ? nextError ?? state.doctor.installError
                  : null,
            },
          }));
          if (status.success === true) {
            void get().runDoctor();
          }
        }

        // After a failed build, surface Problems if diagnostics were captured.
        if (
          !status.running &&
          status.success === false &&
          useProblemsStore.getState().problems.length > 0
        ) {
          useLayoutStore.getState().setBottomPanelTab("problems");
        }
        // After compiledb (or first build without a DB), restart clangd so it
        // picks up newly generated compile_commands.json.
        if (!status.running && status.success === true) {
          const finished = status.task;
          void import("@/stores/lspStore").then(({ useLspStore }) => {
            const lsp = useLspStore.getState();
            if (!lsp.info?.installed) return;
            if (finished === "compiledb") {
              lsp.requestRestart();
              return;
            }
            if (finished === "build" && !lsp.status.compileCommandsDir) {
              lsp.requestRestart();
            }
          });
        }
      },

      clearOutput: () =>
        set({ lines: [], error: null, progress: emptyPioProgress() }),

      runTask: async (task) => {
        const { kind, rootPath } = useWorkspaceStore.getState();
        if (!isTauriRuntime()) {
          set({
            error: localizeError(
              "PlatformIO requires the desktop app (npm run tauri:dev).",
            ),
          });
          return;
        }
        if (kind !== "folder" || !rootPath) {
          set({ error: t("pio.error.needFolder") });
          return;
        }
        if (!get().isProject) {
          set({ error: t("pio.error.noIni") });
          return;
        }
        if (get().running) {
          set({ error: t("pio.error.busy") });
          return;
        }

        const uploadPort = get().getUploadPort().trim();
        if (task === "upload" && !uploadPort) {
          set({ error: t("pio.error.needPort") });
          return;
        }

        // Release the serial port so upload can open it.
        let releasedSerial = false;
        if (task === "upload") {
          const serial = useSerialStore.getState();
          if (serial.connected) {
            try {
              await serial.disconnect();
              releasedSerial = true;
            } catch {
              // continue — upload error mapping covers busy ports
            }
          }
        }

        useProblemsStore.getState().clear();
        useLayoutStore.getState().setBottomPanelTab("output");
        set({
          lines: [],
          error: null,
          lastTask: task,
          lastSuccess: null,
          running: true,
          progress: {
            stage: "starting",
            percent: null,
            detail: null,
          },
        });
        if (releasedSerial) {
          get().appendOutput({
            stream: "system",
            line: t("pio.uploadWillDisconnect"),
          });
        }

        try {
          await runPioTask({
            cwd: rootPath,
            task: task as "build" | "upload" | "clean" | "compiledb",
            env: get().selectedEnv || null,
            uploadPort: task === "upload" ? uploadPort : null,
          });
        } catch (error) {
          set({
            running: false,
            lastSuccess: false,
            progress: {
              stage: "failed",
              percent: null,
              detail: null,
            },
            error: localizeError(
              error instanceof Error
                ? error.message
                : "Failed to start PlatformIO task.",
            ),
          });
        }
      },

      cancel: async () => {
        try {
          await cancelPioTask();
        } catch (error) {
          set({
            error: localizeError(
              error instanceof Error
                ? error.message
                : "Failed to cancel PlatformIO task.",
            ),
          });
        }
      },

      runDoctor: async () => {
        if (!isTauriRuntime()) {
          set({
            doctor: {
              checking: false,
              checked: true,
              installing: false,
              installError: null,
              pio: { installed: false, command: null, version: null },
              python: { installed: false, command: null, version: null },
              clangd: { installed: false, command: null, version: null },
              ok: false,
            },
          });
          return;
        }

        set((state) => ({
          doctor: {
            ...state.doctor,
            checking: true,
            installError: null,
          },
          doctorDismissed: false,
        }));

        try {
          const [pio, python, clangd] = await Promise.all([
            detectPio(),
            detectPython(),
            lspDetect(),
          ]);
          set({
            info: pio,
            doctor: {
              checking: false,
              checked: true,
              installing: false,
              installError: null,
              pio,
              python,
              clangd,
              ok: pio.installed,
            },
          });
          void import("@/stores/lspStore").then(({ useLspStore }) => {
            useLspStore.setState({ info: clangd, error: null });
          });
        } catch (error) {
          set({
            doctor: {
              checking: false,
              checked: true,
              installing: false,
              installError: null,
              pio: get().info,
              python: get().doctor.python,
              clangd: null,
              ok: false,
            },
            error: localizeError(
              error instanceof Error
                ? error.message
                : "Toolchain check failed.",
            ),
          });
        }
      },

      installMissing: async () => {
        if (!isTauriRuntime()) {
          set((state) => ({
            doctor: {
              ...state.doctor,
              installError: t("doctor.needDesktop"),
            },
          }));
          return;
        }
        if (get().running || get().doctor.installing) {
          set((state) => ({
            doctor: {
              ...state.doctor,
              installError: t("pio.error.busy"),
            },
          }));
          return;
        }

        const pio = get().doctor.pio ?? get().info;
        if (pio?.installed) {
          await get().runDoctor();
          return;
        }

        useLayoutStore.getState().setBottomPanelTab("output");
        set((state) => ({
          doctor: {
            ...state.doctor,
            installing: true,
            installError: null,
          },
          lines: [],
          error: null,
          lastTask: "install-core",
          lastSuccess: null,
          progress: {
            stage: "installing",
            percent: null,
            detail: null,
          },
        }));

        try {
          await installPioCore();
          // Give pio-status a moment (early-skip emits success immediately).
          await new Promise((r) => setTimeout(r, 80));
          if (!get().running) {
            set((state) => ({
              doctor: { ...state.doctor, installing: false },
            }));
            if (get().lastSuccess !== false) {
              await get().runDoctor();
            }
          }
        } catch (error) {
          const msg = localizeError(
            error instanceof Error
              ? error.message
              : "Failed to install PlatformIO.",
          );
          set((state) => ({
            running: false,
            lastSuccess: false,
            progress: { stage: "failed", percent: null, detail: null },
            error: msg,
            doctor: {
              ...state.doctor,
              installing: false,
              installError: msg,
            },
          }));
        }
      },

      dismissDoctor: () => set({ doctorDismissed: true }),

      showDoctor: () => set({ doctorDismissed: false }),
    }),
    {
      name: "aether-platformio",
      partialize: (state) => ({
        selectedEnv: state.selectedEnv,
        uploadPortByRoot: state.uploadPortByRoot,
        doctorDismissed: state.doctorDismissed,
      }),
    },
  ),
);
