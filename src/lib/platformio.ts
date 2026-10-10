import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isTauriRuntime } from "@/lib/tauri";

export type PioTask = "build" | "upload" | "clean" | "compiledb";

export interface PioInfo {
  installed: boolean;
  command: string | null;
  version: string | null;
}

export interface PioProjectInfo {
  isProject: boolean;
  iniPath: string | null;
  envs: string[];
}

export interface PioOutputPayload {
  stream: "stdout" | "stderr" | "system" | string;
  line: string;
}

export interface PioStatusPayload {
  running: boolean;
  task: string | null;
  success: boolean | null;
  code: number | null;
  error: string | null;
}

export async function detectPio(): Promise<PioInfo> {
  if (!isTauriRuntime()) {
    return { installed: false, command: null, version: null };
  }
  return invoke<PioInfo>("pio_detect");
}

export async function inspectPioProject(cwd: string): Promise<PioProjectInfo> {
  if (!isTauriRuntime()) {
    return { isProject: false, iniPath: null, envs: [] };
  }
  return invoke<PioProjectInfo>("pio_inspect_project", { cwd });
}

export async function runPioTask(options: {
  cwd: string;
  task: PioTask;
  env?: string | null;
}): Promise<void> {
  return invoke("pio_run", {
    cwd: options.cwd,
    task: options.task,
    env: options.env ?? null,
  });
}

export async function cancelPioTask(): Promise<void> {
  return invoke("pio_cancel");
}

export async function initPioProject(options: {
  parent: string;
  name: string;
  board: string;
}): Promise<string> {
  return invoke<string>("pio_project_init", {
    parent: options.parent,
    name: options.name,
    board: options.board,
  });
}

export async function isPioRunning(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return invoke<boolean>("pio_is_running");
}

export async function listenPioOutput(
  handler: (payload: PioOutputPayload) => void,
): Promise<UnlistenFn> {
  return listen<PioOutputPayload>("pio-output", (event) => {
    handler(event.payload);
  });
}

export async function listenPioStatus(
  handler: (payload: PioStatusPayload) => void,
): Promise<UnlistenFn> {
  return listen<PioStatusPayload>("pio-status", (event) => {
    handler(event.payload);
  });
}
