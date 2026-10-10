import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isTauriRuntime } from "@/lib/tauri";

export interface TerminalCreated {
  id: number;
}

export interface TerminalDataPayload {
  id: number;
  data: string;
}

export interface TerminalExitPayload {
  id: number;
  code: number | null;
}

export async function createTerminal(options: {
  cols: number;
  rows: number;
  cwd?: string | null;
}): Promise<TerminalCreated> {
  return invoke<TerminalCreated>("terminal_create", {
    cols: options.cols,
    rows: options.rows,
    cwd: options.cwd ?? null,
  });
}

export async function writeTerminal(id: number, data: string): Promise<void> {
  return invoke("terminal_write", { id, data });
}

export async function resizeTerminal(
  id: number,
  cols: number,
  rows: number,
): Promise<void> {
  return invoke("terminal_resize", { id, cols, rows });
}

export async function closeTerminal(id: number): Promise<void> {
  return invoke("terminal_close", { id });
}

export async function listenTerminalData(
  handler: (payload: TerminalDataPayload) => void,
): Promise<UnlistenFn> {
  return listen<TerminalDataPayload>("terminal-data", (event) => {
    handler(event.payload);
  });
}

export async function listenTerminalExit(
  handler: (payload: TerminalExitPayload) => void,
): Promise<UnlistenFn> {
  return listen<TerminalExitPayload>("terminal-exit", (event) => {
    handler(event.payload);
  });
}

export function canUseNativeTerminal(): boolean {
  return isTauriRuntime();
}
