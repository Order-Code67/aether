import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  debugContinue,
  debugDeleteBreakpoint,
  debugInsertBreakpoint,
  debugPause,
  debugStack,
  debugStart,
  debugStepInto,
  debugStepOut,
  debugStepOver,
  debugStop,
  debugVariables,
  type DebugConsolePayload,
  type DebugEventPayload,
  type DebugExecState,
  type DebugFrame,
  type DebugVariable,
} from "@/lib/debug";
import { isTauriRuntime } from "@/lib/tauri";
import { useEditorStore } from "@/stores/editorStore";
import { useLayoutStore } from "@/stores/layoutStore";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export interface Breakpoint {
  path: string;
  line: number;
  /** GDB breakpoint number when session is active */
  number: string | null;
  enabled: boolean;
}

interface DebugState {
  sessionActive: boolean;
  execState: DebugExecState;
  error: string | null;
  breakpoints: Breakpoint[];
  frames: DebugFrame[];
  variables: DebugVariable[];
  stoppedFile: string | null;
  stoppedLine: number | null;
  consoleLines: { id: number; stream: string; text: string }[];
  consoleSeq: number;
  toggleBreakpoint: (path: string, line: number) => void;
  clearBreakpoints: () => void;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  continueExec: () => Promise<void>;
  pause: () => Promise<void>;
  stepOver: () => Promise<void>;
  stepInto: () => Promise<void>;
  stepOut: () => Promise<void>;
  applyEvent: (event: DebugEventPayload) => void;
  appendConsole: (payload: DebugConsolePayload) => void;
  clearConsole: () => void;
  refreshStoppedContext: () => Promise<void>;
}

function samePath(a: string, b: string): boolean {
  return a.replace(/\//g, "\\").toLowerCase() === b.replace(/\//g, "\\").toLowerCase();
}

const MAX_CONSOLE = 3000;

export const useDebugStore = create<DebugState>()(
  persist(
    (set, get) => ({
      sessionActive: false,
      execState: "inactive",
      error: null,
      breakpoints: [],
      frames: [],
      variables: [],
      stoppedFile: null,
      stoppedLine: null,
      consoleLines: [],
      consoleSeq: 0,

      toggleBreakpoint: (path, line) => {
        const existing = get().breakpoints.find(
          (b) => samePath(b.path, path) && b.line === line,
        );
        if (existing) {
          const number = existing.number;
          set({
            breakpoints: get().breakpoints.filter(
              (b) => !(samePath(b.path, path) && b.line === line),
            ),
          });
          if (get().sessionActive && number) {
            void debugDeleteBreakpoint(number).catch(() => undefined);
          }
          return;
        }
        const bp: Breakpoint = {
          path,
          line,
          number: null,
          enabled: true,
        };
        set({ breakpoints: [...get().breakpoints, bp] });
        if (get().sessionActive) {
          void debugInsertBreakpoint(path, line)
            .then((res) => {
              set({
                breakpoints: get().breakpoints.map((b) =>
                  samePath(b.path, path) && b.line === line
                    ? { ...b, number: res.number }
                    : b,
                ),
              });
            })
            .catch((error) => {
              set({
                error:
                  error instanceof Error
                    ? error.message
                    : "Failed to set breakpoint.",
              });
            });
        }
      },

      clearBreakpoints: () => set({ breakpoints: [] }),

      start: async () => {
        if (!isTauriRuntime()) {
          set({
            error: "Debugger requires the desktop app (npm run tauri:dev).",
          });
          return;
        }
        const { kind, rootPath } = useWorkspaceStore.getState();
        if (kind !== "folder" || !rootPath) {
          set({ error: "Open a PlatformIO project folder first." });
          return;
        }
        const pio = usePlatformIoStore.getState();
        if (!pio.isProject) {
          set({ error: "No platformio.ini in the active folder." });
          return;
        }
        if (get().sessionActive) {
          set({ error: "Debug session already running." });
          return;
        }

        useLayoutStore.getState().setActiveActivity("debug");
        useLayoutStore.getState().setBottomPanelTab("debug");
        set({
          error: null,
          execState: "starting",
          consoleLines: [],
          frames: [],
          variables: [],
          stoppedFile: null,
          stoppedLine: null,
        });

        try {
          await debugStart(rootPath, pio.selectedEnv || null);
          set({ sessionActive: true, execState: "running" });

          // Apply pending breakpoints
          const next: Breakpoint[] = [];
          for (const bp of get().breakpoints) {
            if (!bp.enabled) {
              next.push(bp);
              continue;
            }
            try {
              const res = await debugInsertBreakpoint(bp.path, bp.line);
              next.push({ ...bp, number: res.number });
            } catch {
              next.push({ ...bp, number: null });
            }
          }
          set({ breakpoints: next });
        } catch (error) {
          set({
            sessionActive: false,
            execState: "inactive",
            error:
              error instanceof Error
                ? error.message
                : "Failed to start debugger.",
          });
        }
      },

      stop: async () => {
        try {
          if (isTauriRuntime()) await debugStop();
        } catch {
          /* ignore */
        }
        set({
          sessionActive: false,
          execState: "inactive",
          frames: [],
          variables: [],
          stoppedFile: null,
          stoppedLine: null,
          breakpoints: get().breakpoints.map((b) => ({
            ...b,
            number: null,
          })),
        });
      },

      continueExec: async () => {
        try {
          await debugContinue();
          set({ execState: "running", stoppedFile: null, stoppedLine: null });
        } catch (error) {
          set({
            error:
              error instanceof Error ? error.message : "Continue failed.",
          });
        }
      },

      pause: async () => {
        try {
          await debugPause();
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Pause failed.",
          });
        }
      },

      stepOver: async () => {
        try {
          await debugStepOver();
          set({ execState: "running" });
        } catch (error) {
          set({
            error:
              error instanceof Error ? error.message : "Step over failed.",
          });
        }
      },

      stepInto: async () => {
        try {
          await debugStepInto();
          set({ execState: "running" });
        } catch (error) {
          set({
            error:
              error instanceof Error ? error.message : "Step into failed.",
          });
        }
      },

      stepOut: async () => {
        try {
          await debugStepOut();
          set({ execState: "running" });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Step out failed.",
          });
        }
      },

      applyEvent: (event) => {
        if (event.kind === "started") {
          set({ sessionActive: true, execState: event.state || "running" });
          return;
        }
        if (event.kind === "exited") {
          set({
            sessionActive: false,
            execState: "inactive",
            frames: [],
            variables: [],
            stoppedFile: null,
            stoppedLine: null,
            breakpoints: get().breakpoints.map((b) => ({
              ...b,
              number: null,
            })),
          });
          return;
        }
        if (event.kind === "running") {
          set({
            execState: "running",
            stoppedFile: null,
            stoppedLine: null,
          });
          return;
        }
        if (event.kind === "stopped") {
          set({
            sessionActive: true,
            execState: "stopped",
            stoppedFile: event.file,
            stoppedLine: event.line,
          });
          if (event.file && event.line) {
            void useWorkspaceStore
              .getState()
              .openPathInEditor(event.file)
              .then(() => {
                useEditorStore.getState().requestReveal({
                  path: event.file!,
                  lineNumber: event.line!,
                  column: 1,
                });
              });
          }
          void get().refreshStoppedContext();
        }
      },

      appendConsole: (payload) => {
        set((state) => {
          const id = state.consoleSeq + 1;
          const lines = [
            ...state.consoleLines,
            { id, stream: payload.stream, text: payload.text },
          ];
          return {
            consoleSeq: id,
            consoleLines:
              lines.length > MAX_CONSOLE
                ? lines.slice(lines.length - MAX_CONSOLE)
                : lines,
          };
        });
      },

      clearConsole: () => set({ consoleLines: [], error: null }),

      refreshStoppedContext: async () => {
        if (!get().sessionActive) return;
        try {
          const [stack, vars] = await Promise.all([
            debugStack(),
            debugVariables(),
          ]);
          set({
            frames: stack.frames ?? [],
            variables: vars.variables ?? [],
          });
        } catch {
          /* ignore transient MI errors while running */
        }
      },
    }),
    {
      name: "aether-debug",
      partialize: (state) => ({
        breakpoints: state.breakpoints.map((b) => ({
          path: b.path,
          line: b.line,
          number: null,
          enabled: b.enabled,
        })),
      }),
    },
  ),
);
