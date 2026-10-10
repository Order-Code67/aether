import { isTauri as detectTauri } from "@tauri-apps/api/core";

export function isTauriRuntime(): boolean {
  try {
    return detectTauri();
  } catch {
    return false;
  }
}
