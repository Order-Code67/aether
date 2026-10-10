import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  cancelPioTask,
  detectPio,
  inspectPioProject,
  runPioTask,
  type PioInfo,
  type PioOutputPayload,
  type PioStatusPayload,
  type PioTask,
} from "@/lib/platformio";
import { isTauriRuntime } from "@/lib/tauri";
import { useLayoutStore } from "@/stores/layoutStore";
import { useProblemsStore } from "@/stores/problemsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

const MAX_LINES = 4000;

export interface OutputLine {
  id: number;
  stream: string;
  text: string;
}

interface PlatformIoState {
  info: PioInfo | null;
  isProject: boolean;
  envs: string[];
  selectedEnv: string;
  running: boolean;
  lastTask: PioTask | null;
  lastSuccess: boolean | null;
  lines: OutputLine[];
  error: string | null;
  lineSeq: number;
  refreshCli: () => Promise<void>;
  refreshProject: () => Promise<void>;
  setSelectedEnv: (env: string) => void;
  appendOutput: (payload: PioOutputPayload) => void;
  applyStatus: (status: PioStatusPayload) => void;
  clearOutput: () => void;
  runTask: (task: PioTask) => Promise<void>;
  cancel: () => Promise<void>;
}

export const usePlatformIoStore = create<PlatformIoState>()(
  persist(
    (set, get) => ({
      info: null,
      isProject: false,
      envs: [],
      selectedEnv: "",
      running: false,
      lastTask: null,
      lastSuccess: null,
      lines: [],
      error: null,
      lineSeq: 0,

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
            error:
              error instanceof Error
                ? error.message
                : "Failed to detect PlatformIO.",
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
            error:
              error instanceof Error
                ? error.message
                : "Failed to inspect PlatformIO project.",
          });
        }
      },

      setSelectedEnv: (env) => set({ selectedEnv: env }),

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
          };
        });
      },

      applyStatus: (status) => {
        set({
          running: status.running,
          lastTask: (status.task as PioTask | null) ?? get().lastTask,
          lastSuccess: status.success,
          error: status.error,
        });
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
          const task = status.task;
          void import("@/stores/lspStore").then(({ useLspStore }) => {
            const lsp = useLspStore.getState();
            if (!lsp.info?.installed) return;
            if (task === "compiledb") {
              lsp.requestRestart();
              return;
            }
            if (task === "build" && !lsp.status.compileCommandsDir) {
              lsp.requestRestart();
            }
          });
        }
      },

      clearOutput: () => set({ lines: [], error: null }),

      runTask: async (task) => {
        const { kind, rootPath } = useWorkspaceStore.getState();
        if (!isTauriRuntime()) {
          set({
            error: "PlatformIO requires the desktop app (npm run tauri:dev).",
          });
          return;
        }
        if (kind !== "folder" || !rootPath) {
          set({ error: "Open a PlatformIO project folder first." });
          return;
        }
        if (!get().isProject) {
          set({ error: "No platformio.ini found in the workspace root." });
          return;
        }
        if (get().running) {
          set({ error: "A PlatformIO task is already running." });
          return;
        }

        useProblemsStore.getState().clear();
        useLayoutStore.getState().setBottomPanelTab("output");
        set({
          lines: [],
          error: null,
          lastTask: task,
          lastSuccess: null,
          running: true,
        });

        try {
          await runPioTask({
            cwd: rootPath,
            task,
            env: get().selectedEnv || null,
          });
        } catch (error) {
          set({
            running: false,
            lastSuccess: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to start PlatformIO task.",
          });
        }
      },

      cancel: async () => {
        try {
          await cancelPioTask();
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : "Failed to cancel PlatformIO task.",
          });
        }
      },
    }),
    {
      name: "aether-platformio",
      partialize: (state) => ({
        selectedEnv: state.selectedEnv,
      }),
    },
  ),
);
