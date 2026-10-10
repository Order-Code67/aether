import { open, save } from "@tauri-apps/plugin-dialog";
import { mkdir, writeTextFile } from "@tauri-apps/plugin-fs";
import { validateManifest } from "@/lib/extensionLoader";
import type { CatalogEntry, ExtensionCatalog } from "@/lib/marketplace";
import { joinPath } from "@/lib/paths";
import { isTauriRuntime } from "@/lib/tauri";
import type {
  ExtensionBoardPreset,
  ExtensionCategory,
  ExtensionManifest,
  ExtensionSnippet,
} from "@/types/extensions";

export interface PublishDraft {
  id: string;
  name: string;
  version: string;
  description: string;
  publisher: string;
  category: ExtensionCategory;
  languages: string[];
  snippets: ExtensionSnippet[];
  boards: ExtensionBoardPreset[];
  /** Optional public HTTPS URL where extension.json will be hosted */
  downloadUrl: string;
}

export interface PublishValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
  manifest?: ExtensionManifest;
}

export function emptyDraft(): PublishDraft {
  return {
    id: "myorg.my-extension",
    name: "My Extension",
    version: "0.1.0",
    description: "",
    publisher: "MyOrg",
    category: "snippets",
    languages: ["cpp", "c"],
    snippets: [],
    boards: [],
    downloadUrl: "",
  };
}

export function draftFromManifest(m: ExtensionManifest): PublishDraft {
  return {
    id: m.id,
    name: m.name,
    version: m.version,
    description: m.description,
    publisher: m.publisher,
    category: m.category,
    languages: m.contributes?.languages?.length
      ? [...m.contributes.languages]
      : ["cpp"],
    snippets: [...(m.contributes?.snippets ?? [])],
    boards: [...(m.contributes?.boards ?? [])],
    downloadUrl: m.path?.startsWith("http") ? m.path : "",
  };
}

export function validateDraft(draft: PublishDraft): PublishValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!draft.id.trim()) errors.push("id is required.");
  else if (!/^[a-z0-9]+(\.[a-z0-9_-]+)+$/i.test(draft.id.trim())) {
    errors.push("id must look like publisher.name (e.g. myorg.helpers).");
  }
  if (!draft.name.trim()) errors.push("name is required.");
  if (!draft.version.trim()) errors.push("version is required.");
  else if (!/^\d+\.\d+\.\d+(-[a-z0-9.-]+)?$/i.test(draft.version.trim())) {
    warnings.push("version should be SemVer (e.g. 1.0.0).");
  }
  if (!draft.publisher.trim()) errors.push("publisher is required.");

  const snip = draft.snippets.filter((s) => s.label.trim() && s.insertText.trim());
  const boards = draft.boards.filter((b) => b.id.trim() && b.label.trim());
  if (snip.length === 0 && boards.length === 0) {
    errors.push("Add at least one snippet or board contribution.");
  }
  for (const s of snip) {
    if (s.label.length > 64) warnings.push(`Snippet "${s.label}" has a long label.`);
  }
  if (draft.downloadUrl.trim() && !/^https:\/\//i.test(draft.downloadUrl.trim())) {
    warnings.push("downloadUrl should be https:// for Marketplace installs.");
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  const raw = {
    id: draft.id.trim(),
    name: draft.name.trim(),
    version: draft.version.trim(),
    description: draft.description.trim(),
    publisher: draft.publisher.trim(),
    category: draft.category,
    contributes: {
      languages: draft.languages.length ? draft.languages : ["cpp"],
      snippets: snip,
      boards,
    },
  };

  try {
    const manifest = validateManifest(raw);
    return { ok: true, errors, warnings, manifest };
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "Invalid manifest.");
    return { ok: false, errors, warnings };
  }
}

/** Stable content fingerprint for hub integrity (not a cryptographic signature). */
export async function contentHash(manifest: ExtensionManifest): Promise<string> {
  const payload = JSON.stringify({
    id: manifest.id,
    version: manifest.version,
    contributes: manifest.contributes,
  });
  const data = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function toPublishableJson(manifest: ExtensionManifest): string {
  const body = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    publisher: manifest.publisher,
    category: manifest.category,
    contributes: manifest.contributes,
  };
  return `${JSON.stringify(body, null, 2)}\n`;
}

export function buildCatalogEntry(
  manifest: ExtensionManifest,
  downloadUrl: string,
  hash?: string,
): CatalogEntry {
  const url =
    downloadUrl.trim() ||
    `hub://local/${manifest.id}@${manifest.version}`;
  return {
    id: manifest.id,
    name: manifest.name,
    description: manifest.description,
    publisher: manifest.publisher,
    category: manifest.category,
    downloadUrl: url,
    contentHash: hash,
    fallback: {
      ...manifest,
      source: "local",
      path: url,
    },
  };
}

export function buildHubCatalog(
  entries: CatalogEntry[],
): ExtensionCatalog {
  return {
    version: 1,
    updated: new Date().toISOString().slice(0, 10),
    entries: [...entries].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

/** Write extension.json (+ optional README) into a chosen parent folder. */
export async function exportExtensionPackage(
  manifest: ExtensionManifest,
): Promise<string | null> {
  if (!isTauriRuntime()) {
    throw new Error("Export requires the desktop app.");
  }
  const parent = await open({
    directory: true,
    multiple: false,
    title: "Choose folder for the extension package",
  });
  if (typeof parent !== "string") return null;

  const folderName = manifest.id.replace(/\./g, "-");
  const dir = joinPath(parent, folderName);
  await mkdir(dir, { recursive: true });
  await writeTextFile(joinPath(dir, "extension.json"), toPublishableJson(manifest));
  await writeTextFile(
    joinPath(dir, "README.md"),
    `# ${manifest.name}\n\n${manifest.description}\n\n` +
      `Publisher: ${manifest.publisher}  \n` +
      `Version: ${manifest.version}  \n` +
      `Id: \`${manifest.id}\`\n`,
  );
  return dir;
}

/** Save hub catalog.json via save dialog. */
export async function exportHubCatalogFile(
  catalog: ExtensionCatalog,
): Promise<string | null> {
  if (!isTauriRuntime()) {
    throw new Error("Export requires the desktop app.");
  }
  const path = await save({
    title: "Export hub catalog.json",
    defaultPath: "catalog.json",
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (typeof path !== "string") return null;
  await writeTextFile(path, `${JSON.stringify(catalog, null, 2)}\n`);
  return path;
}
