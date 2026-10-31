import { save } from "@tauri-apps/plugin-dialog";
import { writeFile, BaseDirectory } from "@tauri-apps/plugin-fs";
import { isTauriRuntime } from "@/services/tauri";
import { dbUpsertRecording } from "@/services/database";
import { eventBus } from "@/services/events/eventBus";

export interface DiskRecordingResult {
  id: string;
  path: string;
  sizeBytes: number;
}

/**
 * Persist recording blob to a user-chosen folder and register metadata in SQLite.
 */
export async function saveRecordingToDisk(
  blob: Blob,
  sourceId: string,
  preferredName?: string,
): Promise<DiskRecordingResult | null> {
  const id = `rec_${Date.now().toString(36)}`;
  const defaultName =
    preferredName ?? `ags_${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
  const bytes = new Uint8Array(await blob.arrayBuffer());

  if (!isTauriRuntime()) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = defaultName;
    a.click();
    URL.revokeObjectURL(url);
    eventBus.emit(
      "info",
      "recording",
      "Запись скачана в браузере (SQLite недоступен в preview)",
    );
    return { id, path: defaultName, sizeBytes: blob.size };
  }

  const path = await save({
    defaultPath: defaultName,
    filters: [{ name: "WebM", extensions: ["webm"] }],
  });
  if (!path) {
    eventBus.emit("warning", "recording", "Сохранение отменено");
    return null;
  }

  await writeFile(path, bytes);
  const start = new Date().toISOString();
  await dbUpsertRecording({
    id,
    sourceId,
    filename: path,
    startTime: start,
    endTime: start,
    metadata: {
      mimeType: blob.type || "video/webm",
      sizeBytes: blob.size,
      savedAt: start,
    },
  });
  eventBus.emit("info", "recording", `Запись на диск: ${path}`);
  return { id, path, sizeBytes: blob.size };
}

/** Optional: write under app data when path not chosen. */
export async function saveRecordingAppData(
  blob: Blob,
  filename: string,
): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  await writeFile(filename, bytes, { baseDir: BaseDirectory.AppData });
  return filename;
}
