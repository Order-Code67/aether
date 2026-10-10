import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isTauriRuntime } from "@/lib/tauri";

export interface LspInfo {
  installed: boolean;
  command: string | null;
  version: string | null;
}

export interface LspStatus {
  running: boolean;
  root: string | null;
  compileCommandsDir: string | null;
  error: string | null;
}

export interface LspNotification {
  method: string;
  params: unknown;
}

export async function lspDetect(): Promise<LspInfo> {
  if (!isTauriRuntime()) {
    return { installed: false, command: null, version: null };
  }
  return invoke<LspInfo>("lsp_detect");
}

export async function lspStart(root: string): Promise<LspStatus> {
  return invoke<LspStatus>("lsp_start", { root });
}

export async function lspStop(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("lsp_stop");
}

export async function lspStatus(): Promise<LspStatus> {
  if (!isTauriRuntime()) {
    return {
      running: false,
      root: null,
      compileCommandsDir: null,
      error: null,
    };
  }
  return invoke<LspStatus>("lsp_status");
}

export async function lspNotify(
  method: string,
  params: unknown,
): Promise<void> {
  await invoke("lsp_notify", { method, params });
}

export async function lspRequest<T = unknown>(
  method: string,
  params: unknown,
): Promise<T> {
  return invoke<T>("lsp_request", { method, params });
}

export async function lspPathToUri(path: string): Promise<string> {
  if (!isTauriRuntime()) {
    return `file:///${path.replace(/\\/g, "/")}`;
  }
  return invoke<string>("lsp_path_to_uri", { path });
}

export async function listenLspNotification(
  handler: (payload: LspNotification) => void,
): Promise<UnlistenFn> {
  return listen<LspNotification>("lsp-notification", (e) => handler(e.payload));
}

export async function listenLspStatus(
  handler: (payload: LspStatus) => void,
): Promise<UnlistenFn> {
  return listen<LspStatus>("lsp-status", (e) => handler(e.payload));
}

export function isCppPath(path: string): boolean {
  return /\.(c|cc|cpp|cxx|h|hh|hpp|hxx|ino)$/i.test(path);
}

export function languageIdForPath(path: string): string {
  if (/\.(h|hh|hpp|hxx)$/i.test(path)) return "cpp";
  if (/\.(c)$/i.test(path)) return "c";
  return "cpp";
}
