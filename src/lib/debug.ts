import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isTauriRuntime } from "@/lib/tauri";

export type DebugExecState =
  | "inactive"
  | "starting"
  | "running"
  | "stopped"
  | string;

export interface DebugStatus {
  running: boolean;
  state: DebugExecState;
  cwd: string | null;
  env: string | null;
  error: string | null;
}

export interface DebugConsolePayload {
  stream: string;
  text: string;
}

export interface DebugEventPayload {
  kind: string;
  state: DebugExecState;
  file: string | null;
  line: number | null;
  reason: string | null;
  frames: unknown;
  variables: unknown;
  error: string | null;
}

export interface DebugFrame {
  level: number;
  file: string | null;
  line: number | null;
  function: string | null;
}

export interface DebugVariable {
  name: string;
  value: string;
}

export async function debugStatus(): Promise<DebugStatus> {
  if (!isTauriRuntime()) {
    return {
      running: false,
      state: "inactive",
      cwd: null,
      env: null,
      error: null,
    };
  }
  return invoke<DebugStatus>("debug_status");
}

export async function debugStart(
  cwd: string,
  env?: string | null,
): Promise<DebugStatus> {
  return invoke<DebugStatus>("debug_start", { cwd, env: env ?? null });
}

export async function debugStop(): Promise<void> {
  await invoke("debug_stop");
}

export async function debugContinue(): Promise<void> {
  await invoke("debug_continue");
}

export async function debugPause(): Promise<void> {
  await invoke("debug_pause");
}

export async function debugStepOver(): Promise<void> {
  await invoke("debug_step_over");
}

export async function debugStepInto(): Promise<void> {
  await invoke("debug_step_into");
}

export async function debugStepOut(): Promise<void> {
  await invoke("debug_step_out");
}

export async function debugInsertBreakpoint(
  path: string,
  line: number,
): Promise<{ number: string | null; raw: string }> {
  return invoke("debug_insert_breakpoint", { path, line });
}

export async function debugDeleteBreakpoint(number: string): Promise<void> {
  await invoke("debug_delete_breakpoint", { number });
}

export async function debugStack(): Promise<{
  frames: DebugFrame[];
  raw: string;
}> {
  return invoke("debug_stack");
}

export async function debugVariables(): Promise<{
  variables: DebugVariable[];
  raw: string;
}> {
  return invoke("debug_variables");
}

export async function debugEval(expression: string): Promise<string> {
  return invoke<string>("debug_eval", { expression });
}

export async function debugConsoleInput(command: string): Promise<void> {
  await invoke("debug_console_input", { command });
}

export async function listenDebugEvent(
  handler: (payload: DebugEventPayload) => void,
): Promise<UnlistenFn> {
  return listen<DebugEventPayload>("debug-event", (e) => handler(e.payload));
}

export async function listenDebugConsole(
  handler: (payload: DebugConsolePayload) => void,
): Promise<UnlistenFn> {
  return listen<DebugConsolePayload>("debug-console", (e) =>
    handler(e.payload),
  );
}
