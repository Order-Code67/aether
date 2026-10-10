import { documentDir, join } from "@tauri-apps/api/path";
import { open, save } from "@tauri-apps/plugin-dialog";
import { mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import type { Locale } from "@/i18n";
import { isTauriRuntime } from "@/lib/tauri";
import type { FirmwareProfile } from "@/stores/firmwareProfileStore";
import {
  parseFirmwareProfilesJson,
  serializeFirmwareProfiles,
  type FirmwareProfilesIoErrorKey,
} from "@/lib/firmwareProfilesIo";

async function defaultProfilesDir(): Promise<string> {
  const docs = await documentDir();
  const dir = await join(docs, "Aether", "profiles");
  await mkdir(dir, { recursive: true });
  return dir;
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export async function exportFirmwareProfilesToFile(
  profiles: FirmwareProfile[],
  locale: Locale,
): Promise<string | null> {
  if (!isTauriRuntime()) {
    throw new Error(
      locale === "ru"
        ? "Экспорт профилей доступен в десктоп-приложении."
        : "Profile export requires the desktop app.",
    );
  }
  if (profiles.length === 0) return null;

  const dir = await defaultProfilesDir();
  const suggested = await join(dir, `aether-profiles-${stamp()}.json`);
  const chosen = await save({
    title:
      locale === "ru" ? "Экспорт профилей прошивки" : "Export firmware profiles",
    defaultPath: suggested,
    filters: [{ name: "JSON", extensions: ["json"] }],
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
  await writeTextFile(chosen, serializeFirmwareProfiles(profiles));
  return chosen;
}

export type ImportFirmwareProfilesFileResult =
  | { ok: true; profiles: FirmwareProfile[]; path: string }
  | { ok: false; errorKey: FirmwareProfilesIoErrorKey }
  | { ok: false; cancelled: true };

export async function importFirmwareProfilesFromFile(
  locale: Locale,
): Promise<ImportFirmwareProfilesFileResult> {
  if (!isTauriRuntime()) {
    throw new Error(
      locale === "ru"
        ? "Импорт профилей доступен в десктоп-приложении."
        : "Profile import requires the desktop app.",
    );
  }
  const dir = await defaultProfilesDir();
  const chosen = await open({
    title:
      locale === "ru" ? "Импорт профилей прошивки" : "Import firmware profiles",
    defaultPath: dir,
    multiple: false,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (typeof chosen !== "string" || !chosen) {
    return { ok: false, cancelled: true };
  }
  const text = await readTextFile(chosen);
  const parsed = parseFirmwareProfilesJson(text);
  if (!parsed.ok) return parsed;
  return { ok: true, profiles: parsed.profiles, path: chosen };
}
