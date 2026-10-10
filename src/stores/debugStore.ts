import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  debugConsoleInput,
  debugContinue,
  debugDeleteBreakpoint,
  debugEval,
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
import { friendlyDebugError } from "@/lib/debugErrors";
import {
  isConditionTruthy,
  normalizeWatchExpression,
} from "@/lib/debugWatch";
import { isTauriRuntime } from "@/lib/tauri";
import { useEditorStore } from "@/stores/editorStore";
import { useLayoutStore } from "@/stores/layoutStore";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

function localizeDebugError(message: string): string {
  return friendlyDebugError(message, useSettingsStore.getState().locale);
}

function noSessionError(): string {
  const locale = useSettingsStore.getState().locale;
  return locale === "ru"
    ? "Нет активной сессии отладки. Сначала запустите отладчик."
    : "No active debug session. Start the debugger first.";
}

function notPausedError(): string {
  const locale = useSettingsStore.getState().locale;
  return locale === "ru"
    ? "Оценка выражений доступна только на паузе."
    : "Expression evaluation is only available while paused.";
}

export interface Breakpoint {
  path: string;
  line: number;
  /** GDB breakpoint number when session is active */
  number: string | null;
  enabled: boolean;
  /** Optional GDB-style condition expression; empty = always stop. */
  condition?: string;
}

export interface WatchEntry {
  id: string;
  expression: string;
  value: string | null;
  error: string | null;
}

interface DebugState {
  sessionActive: boolean;
  execState: DebugExecState;
  error: string | null;
  breakpoints: Breakpoint[];
  watches: WatchEntry[];
  frames: DebugFrame[];
  variables: DebugVariable[];
  stoppedFile: string | null;
  stoppedLine: number | null;
  consoleLines: { id: number; stream: string; text: string }[];
  consoleSeq: number;
  toggleBreakpoint: (path: string, line: number) => void;
  setBreakpointCondition: (
    path: string,
    line: number,
    condition: string,
  ) => void;
  clearBreakpoints: () => void;
  addWatch: (expression: string) => string | null;
  removeWatch: (id: string) => void;
  refreshWatches: () => Promise<void>;
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
  /** After stop: evaluate BP condition; continue if false. */
  handleConditionalStop: () => Promise<void>;
}

function samePath(a: string, b: string): boolean {
  return a.replace(/\//g, "\\").toLowerCase() === b.replace(/\//g, "\\").toLowerCase();
}

function newWatchId(): string {
  return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

const MAX_CONSOLE = 3000;

export const useDebugStore = create<DebugState>()(
  persist(
    (set, get) => ({
      sessionActive: false,
      execState: "inactive",
      error: null,
      breakpoints: [],
      watches: [],
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
          condition: "",
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
              const raw =
                error instanceof Error
                  ? error.message
                  : "Failed to set breakpoint.";
              set({ error: localizeDebugError(raw) });
            });
        }
      },

      setBreakpointCondition: (path, line, condition) => {
        const trimmed = condition.trim();
        set({
          breakpoints: get().breakpoints.map((b) =>
            samePath(b.path, path) && b.line === line
              ? { ...b, condition: trimmed }
              : b,
          ),
        });
        const bp = get().breakpoints.find(
          (b) => samePath(b.path, path) && b.line === line,
        );
        // Best-effort: push condition to GDB when we have a number
        if (get().sessionActive && bp?.number) {
          const cmd = trimmed
            ? `-break-condition ${bp.number} ${trimmed}`
            : `-break-condition ${bp.number}`;
          void debugConsoleInput(cmd).catch(() => undefined);
        }
      },

      clearBreakpoints: () => set({ breakpoints: [] }),

      addWatch: (expression) => {
        const expr = normalizeWatchExpression(expression);
        if (!expr) return null;
        if (get().watches.some((w) => w.expression === expr)) return null;
        const entry: WatchEntry = {
          id: newWatchId(),
          expression: expr,
          value: null,
          error: null,
        };
        set({ watches: [...get().watches, entry] });
        if (get().sessionActive && get().execState === "stopped") {
          void get().refreshWatches();
        }
        return entry.id;
      },

      removeWatch: (id) =>
        set({ watches: get().watches.filter((w) => w.id !== id) }),

      refreshWatches: async () => {
        const watches = get().watches;
        if (watches.length === 0) return;
        if (!get().sessionActive) {
          set({
            watches: watches.map((w) => ({
              ...w,
              value: null,
              error: noSessionError(),
            })),
          });
          return;
        }
        if (get().execState !== "stopped") {
          set({
            watches: watches.map((w) => ({
              ...w,
              value: null,
              error: notPausedError(),
            })),
          });
          return;
        }
        const next: WatchEntry[] = [];
        for (const w of watches) {
          try {
            const value = await debugEval(w.expression);
            next.push({ ...w, value, error: null });
          } catch (error) {
            const raw =
              error instanceof Error ? error.message : String(error);
            next.push({
              ...w,
              value: null,
              error: localizeDebugError(raw),
            });
          }
        }
        set({ watches: next });
      },

      start: async () => {
        const locale = useSettingsStore.getState().locale;
        const surfaceStartError = (message: string) => {
          set({ error: message });
          useLayoutStore.getState().setActiveActivity("debug");
          useLayoutStore.getState().setBottomPanelTab("debug");
          useSettingsStore.getState().flashNotice(message, 4000);
        };
        if (!isTauriRuntime()) {
          surfaceStartError(
            locale === "ru"
              ? "Отладчик доступен в десктоп-приложении (npm run tauri:dev)."
              : "Debugger requires the desktop app (npm run tauri:dev).",
          );
          return;
        }
        const { kind, rootPath } = useWorkspaceStore.getState();
        if (kind !== "folder" || !rootPath) {
          surfaceStartError(
            locale === "ru"
              ? "Сначала откройте папку проекта PlatformIO."
              : "Open a PlatformIO project folder first.",
          );
          return;
        }
        const pio = usePlatformIoStore.getState();
        if (!pio.isProject) {
          surfaceStartError(
            locale === "ru"
              ? "В активной папке нет platformio.ini."
              : "No platformio.ini in the active folder.",
          );
          return;
        }
        if (get().sessionActive) {
          surfaceStartError(
            locale === "ru"
              ? "Сессия отладки уже запущена."
              : "Debug session already running.",
          );
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

          const next: Breakpoint[] = [];
          for (const bp of get().breakpoints) {
            if (!bp.enabled) {
              next.push(bp);
              continue;
            }
            try {
              const res = await debugInsertBreakpoint(bp.path, bp.line);
              next.push({ ...bp, number: res.number });
              if (bp.condition?.trim() && res.number) {
                await debugConsoleInput(
                  `-break-condition ${res.number} ${bp.condition.trim()}`,
                ).catch(() => undefined);
              }
            } catch {
              next.push({ ...bp, number: null });
            }
          }
          set({ breakpoints: next });
        } catch (error) {
          const raw =
            error instanceof Error
              ? error.message
              : "Failed to start debugger.";
          set({
            sessionActive: false,
            execState: "inactive",
            error: localizeDebugError(raw),
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
          watches: get().watches.map((w) => ({
            ...w,
            value: null,
            error: null,
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
          void (async () => {
            await get().handleConditionalStop();
            if (get().execState !== "stopped") return;
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
            void get().refreshWatches();
          })();
        }
      },

      handleConditionalStop: async () => {
        const file = get().stoppedFile;
        const line = get().stoppedLine;
        if (!file || line == null) return;
        const bp = get().breakpoints.find(
          (b) => samePath(b.path, file) && b.line === line,
        );
        const cond = bp?.condition?.trim();
        if (!cond) return;
        try {
          const value = await debugEval(cond);
          if (!isConditionTruthy(value)) {
            await debugContinue();
            set({
              execState: "running",
              stoppedFile: null,
              stoppedLine: null,
            });
          }
        } catch {
          // If condition evaluation fails, stay stopped (safer)
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
          condition: b.condition ?? "",
        })),
        watches: state.watches.map((w) => ({
          id: w.id,
          expression: w.expression,
          value: null,
          error: null,
        })),
      }),
    },
  ),
);
