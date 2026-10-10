import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isTauriRuntime } from "@/lib/tauri";

export interface FsChangedPayload {
  root: string;
  paths: string[];
}

export async function watchStart(root: string): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("watch_start", { root });
}

export async function watchSync(roots: string[]): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("watch_sync", { roots });
}

export async function watchStop(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("watch_stop");
}

export async function listenFsChanged(
  handler: (payload: FsChangedPayload) => void,
): Promise<UnlistenFn> {
  return listen<FsChangedPayload>("fs-changed", (event) => {
    handler(event.payload);
  });
}
