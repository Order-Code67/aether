import { invoke } from "@tauri-apps/api/core";
import type { AppInfo } from "@/types";

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function getAppInfo(): Promise<AppInfo | null> {
  if (!isTauriRuntime()) return null;
  return invoke<AppInfo>("get_app_info");
}
