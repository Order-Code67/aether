import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/services/tauri";

export const DATABASE_READY = true;

export async function dbInit(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  return invoke<string>("db_init");
}

export async function dbAppendEvent(event: {
  id: string;
  at: string;
  severity: string;
  source: string;
  message: string;
}): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("db_append_event", event);
}

export async function dbBackup(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  return invoke<string>("db_backup");
}

export async function dbUpsertSetting(key: string, value: string): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("db_upsert_setting", { key, value });
}
