import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { fetchWithTimeout, HTTP_TIMEOUT_MS } from "@/lib/offline";
import { joinPath } from "@/lib/paths";
import { isAppOffline } from "@/stores/offlineStore";
import { isTauriRuntime } from "@/lib/tauri";
import type {
  ExtensionBoardPreset,
  ExtensionManifest,
  ExtensionSnippet,
} from "@/types/extensions";

interface RawManifest {
  id?: string;
  name?: string;
  version?: string;
  description?: string;
  publisher?: string;
  category?: ExtensionManifest["category"];
  contributes?: {
    languages?: string[];
    snippets?: ExtensionSnippet[];
    boards?: ExtensionBoardPreset[];
  };
}

export function validateManifest(
  raw: RawManifest,
  folderPath?: string,
): ExtensionManifest {
  if (!raw.id || !raw.name) {
    throw new Error("extension.json must include id and name.");
  }
  if (!/^[a-z0-9]+(\.[a-z0-9_-]+)+$/i.test(raw.id)) {
    throw new Error(
      "Invalid extension id (use publisher.name, e.g. myorg.helpers).",
    );
  }
  return {
    id: raw.id,
    name: raw.name,
    version: raw.version ?? "0.0.1",
    description: raw.description ?? "",
    publisher: raw.publisher ?? "Local",
    category: raw.category ?? "other",
    source: "local",
    path: folderPath,
    contributes: {
      languages: raw.contributes?.languages ?? ["cpp"],
      snippets: raw.contributes?.snippets ?? [],
      boards: raw.contributes?.boards ?? [],
    },
  };
}

/** Fetch and validate an extension.json from an HTTP(S) URL. */
export async function loadExtensionFromUrl(
  url: string,
): Promise<ExtensionManifest> {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("Only http(s) URLs are supported.");
  }
  if (isAppOffline()) {
    throw new Error("Offline — cannot download extensions.");
  }
  const res = await fetchWithTimeout(trimmed, undefined, HTTP_TIMEOUT_MS);
  if (!res.ok) {
    throw new Error(`Download failed (${res.status}).`);
  }
  const text = await res.text();
  let raw: RawManifest;
  try {
    raw = JSON.parse(text) as RawManifest;
  } catch {
    throw new Error("Downloaded file is not valid JSON.");
  }
  const manifest = validateManifest(raw, trimmed);
  return manifest;
}

/** Pick a folder containing extension.json and load it. */
export async function pickAndLoadExtension(): Promise<ExtensionManifest | null> {
  if (!isTauriRuntime()) {
    throw new Error("Loading extensions requires the desktop app.");
  }

  const selected = await open({
    directory: true,
    multiple: false,
    title: "Select extension folder (with extension.json)",
  });
  if (typeof selected !== "string") return null;

  const manifestPath = joinPath(selected, "extension.json");
  const text = await readTextFile(manifestPath);
  let raw: RawManifest;
  try {
    raw = JSON.parse(text) as RawManifest;
  } catch {
    throw new Error("extension.json is not valid JSON.");
  }
  return validateManifest(raw, selected);
}

export function collectSnippets(
  manifests: ExtensionManifest[],
  language: string,
): ExtensionSnippet[] {
  const out: ExtensionSnippet[] = [];
  for (const m of manifests) {
    const langs = m.contributes?.languages ?? [];
    if (langs.length > 0 && !langs.includes(language)) continue;
    for (const s of m.contributes?.snippets ?? []) {
      out.push(s);
    }
  }
  return out;
}

export function collectBoards(
  manifests: ExtensionManifest[],
): ExtensionBoardPreset[] {
  const seen = new Set<string>();
  const out: ExtensionBoardPreset[] = [];
  for (const m of manifests) {
    for (const b of m.contributes?.boards ?? []) {
      if (seen.has(b.id)) continue;
      seen.add(b.id);
      out.push(b);
    }
  }
  return out;
}
