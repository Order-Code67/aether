/**
 * Automatic config backup under Documents/Aether/drones/diffs before MSP/CLI writes.
 */

import { join } from "@tauri-apps/api/path";
import { mkdir, writeTextFile } from "@tauri-apps/plugin-fs";
import { defaultInavDiffsDir } from "@/lib/inavDiffFile";
import { isTauriRuntime } from "@/lib/tauri";

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * Write backup text to Documents/Aether/drones/diffs/<prefix>_<stamp>.txt
 * Returns the absolute path, or null when not in Tauri / empty content.
 */
export async function saveAutoDiffBackup(
  content: string,
  prefix: string,
): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const text = content.trim();
  if (!text) return null;
  const dir = await defaultInavDiffsDir();
  const safe = prefix.replace(/[^\w.-]+/g, "_").slice(0, 48) || "backup";
  const path = await join(dir, `${safe}_${stamp()}.txt`);
  try {
    await mkdir(dir, { recursive: true });
  } catch {
    // exists
  }
  await writeTextFile(path, content.endsWith("\n") ? content : `${content}\n`);
  return path;
}
