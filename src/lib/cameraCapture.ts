import { documentDir, join } from "@tauri-apps/api/path";
import { open, save } from "@tauri-apps/plugin-dialog";
import { mkdir, writeFile } from "@tauri-apps/plugin-fs";
import type { Locale } from "@/i18n";
import { isTauriRuntime } from "@/lib/tauri";

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function ensureCameraDir(): Promise<string> {
  const docs = await documentDir();
  const dir = await join(docs, "Aether", "camera");
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function fetchImageBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

function guessExt(url: string, preferJpeg: boolean): "jpg" | "png" {
  const lower = url.toLowerCase();
  if (lower.includes(".png")) return "png";
  if (lower.includes(".jpg") || lower.includes(".jpeg") || preferJpeg) {
    return "jpg";
  }
  return "jpg";
}

/** Save current camera frame via save dialog (default Documents/Aether/camera). */
export async function saveCameraFrameToDisk(
  imageUrl: string,
  locale: Locale,
): Promise<string | null> {
  if (!isTauriRuntime()) {
    throw new Error(
      locale === "ru"
        ? "Сохранение кадра доступно в десктоп-приложении."
        : "Saving a frame requires the desktop app.",
    );
  }
  if (!imageUrl) return null;

  const bytes = await fetchImageBytes(imageUrl);
  const ext = guessExt(imageUrl, true);
  const dir = await ensureCameraDir();
  const suggested = await join(dir, `frame-${stamp()}.${ext}`);
  const chosen = await save({
    title: locale === "ru" ? "Сохранить кадр" : "Save camera frame",
    defaultPath: suggested,
    filters: [
      { name: "JPEG", extensions: ["jpg", "jpeg"] },
      { name: "PNG", extensions: ["png"] },
    ],
  });
  if (typeof chosen !== "string" || !chosen) return null;

  const parent = chosen.replace(/[/\\][^/\\]+$/, "");
  if (parent && parent !== chosen) {
    try {
      await mkdir(parent, { recursive: true });
    } catch {
      /* exist */
    }
  }
  await writeFile(chosen, bytes);
  return chosen;
}

/** Pick a folder and write N frames as frame-0001.jpg … */
export async function recordCameraSeriesToFolder(options: {
  getNextUrl: () => string;
  frameCount: number;
  intervalMs: number;
  locale: Locale;
  onProgress?: (done: number, total: number) => void;
  shouldAbort?: () => boolean;
}): Promise<{ folder: string; saved: number } | null> {
  const { getNextUrl, frameCount, intervalMs, locale, onProgress, shouldAbort } =
    options;
  if (!isTauriRuntime()) {
    throw new Error(
      locale === "ru"
        ? "Запись серии доступна в десктоп-приложении."
        : "Series recording requires the desktop app.",
    );
  }

  const base = await ensureCameraDir();
  const chosen = await open({
    title:
      locale === "ru"
        ? "Папка для серии кадров"
        : "Folder for camera series",
    defaultPath: base,
    directory: true,
    multiple: false,
  });
  if (typeof chosen !== "string" || !chosen) return null;

  const seriesDir = await join(chosen, `series-${stamp()}`);
  await mkdir(seriesDir, { recursive: true });

  let saved = 0;
  const total = Math.max(1, Math.floor(frameCount));
  for (let i = 0; i < total; i++) {
    if (shouldAbort?.()) break;
    const url = getNextUrl();
    if (!url) break;
    try {
      const bytes = await fetchImageBytes(url);
      const name = `frame-${String(i + 1).padStart(4, "0")}.jpg`;
      const path = await join(seriesDir, name);
      await writeFile(path, bytes);
      saved += 1;
      onProgress?.(saved, total);
    } catch {
      // skip failed frame; continue series
      onProgress?.(saved, total);
    }
    if (i < total - 1 && intervalMs > 0) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  return { folder: seriesDir, saved };
}

/** Exponential backoff delay (ms) for reconnect attempts. */
export function cameraReconnectDelayMs(attempt: number): number {
  const n = Math.max(0, Math.floor(attempt));
  return Math.min(15_000, 500 * 2 ** Math.min(n, 5));
}
