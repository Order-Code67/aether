import { documentDir, join } from "@tauri-apps/api/path";
import { open, save } from "@tauri-apps/plugin-dialog";
import { mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import type { Locale } from "@/i18n";
import { suggestDiffFileStem } from "@/lib/inavDiff";
import { isTauriRuntime } from "@/lib/tauri";

export async function defaultInavDiffsDir(): Promise<string> {
  const docs = await documentDir();
  const dir = await join(docs, "Aether", "drones", "diffs");
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function saveInavDiffToFile(
  content: string,
  locale: Locale,
  portLabel?: string,
): Promise<string | null> {
  if (!isTauriRuntime()) {
    throw new Error(
      locale === "ru"
        ? "Сохранение diff доступно в десктоп-приложении."
        : "Saving diffs requires the desktop app.",
    );
  }
  const text = content.trim();
  if (!text) return null;

  const dir = await defaultInavDiffsDir();
  const suggested = await join(
    dir,
    `${suggestDiffFileStem(portLabel)}.txt`,
  );
  const chosen = await save({
    title: locale === "ru" ? "Сохранить iNav diff" : "Save iNav diff",
    defaultPath: suggested,
    filters: [
      { name: "Text", extensions: ["txt"] },
      { name: "All", extensions: ["*"] },
    ],
  });
  if (typeof chosen !== "string" || !chosen) return null;

  const parent = chosen.replace(/[/\\][^/\\]+$/, "");
  if (parent && parent !== chosen) {
    try {
      await mkdir(parent, { recursive: true });
    } catch {
      // may exist
    }
  }
  await writeTextFile(chosen, content.endsWith("\n") ? content : `${content}\n`);
  return chosen;
}

export async function loadInavDiffFromFile(
  locale: Locale,
): Promise<{ path: string; content: string } | null> {
  if (!isTauriRuntime()) {
    throw new Error(
      locale === "ru"
        ? "Загрузка diff доступна в десктоп-приложении."
        : "Loading diffs requires the desktop app.",
    );
  }
  const dir = await defaultInavDiffsDir();
  const chosen = await open({
    title: locale === "ru" ? "Загрузить iNav diff" : "Load iNav diff",
    defaultPath: dir,
    multiple: false,
    filters: [
      { name: "Text", extensions: ["txt", "diff", "cli"] },
      { name: "All", extensions: ["*"] },
    ],
  });
  if (typeof chosen !== "string" || !chosen) return null;
  const content = await readTextFile(chosen);
  return { path: chosen, content };
}
