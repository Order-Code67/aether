import bundledCatalog from "@/extensions/catalog.json";
import {
  loadExtensionFromUrl,
  validateManifest,
} from "@/lib/extensionLoader";
import { fetchWithTimeout, HTTP_TIMEOUT_MS } from "@/lib/offline";
import { isAppOffline } from "@/stores/offlineStore";
import type { ExtensionManifest } from "@/types/extensions";

export interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  publisher: string;
  category: string;
  downloadUrl: string;
  /** Used when remote URL is unreachable (offline / 404) or hub:// local. */
  fallback?: ExtensionManifest;
  /** Optional SHA-256 of publishable content (hub integrity hint). */
  contentHash?: string;
}

export interface ExtensionCatalog {
  version: number;
  updated?: string;
  entries: CatalogEntry[];
}

export function getBundledCatalog(): ExtensionCatalog {
  return bundledCatalog as ExtensionCatalog;
}

/** Merge catalogs; earlier lists win on duplicate ids. */
export function mergeCatalogs(
  ...catalogs: ExtensionCatalog[]
): ExtensionCatalog {
  const seen = new Set<string>();
  const entries: CatalogEntry[] = [];
  for (const cat of catalogs) {
    for (const entry of cat.entries ?? []) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      entries.push(entry);
    }
  }
  return {
    version: 1,
    updated: new Date().toISOString().slice(0, 10),
    entries,
  };
}

export async function fetchCatalog(
  remoteUrl: string | null,
  hubEntries: CatalogEntry[] = [],
): Promise<ExtensionCatalog> {
  const hub: ExtensionCatalog = {
    version: 1,
    updated: new Date().toISOString().slice(0, 10),
    entries: hubEntries,
  };

  let remoteOrBundled: ExtensionCatalog;
  if (!remoteUrl?.trim() || isAppOffline()) {
    remoteOrBundled = getBundledCatalog();
  } else {
    try {
      const res = await fetchWithTimeout(
        remoteUrl.trim(),
        undefined,
        HTTP_TIMEOUT_MS,
      );
      if (!res.ok) throw new Error(`Catalog HTTP ${res.status}`);
      const data = (await res.json()) as ExtensionCatalog;
      if (!Array.isArray(data.entries)) {
        throw new Error("Invalid catalog shape.");
      }
      remoteOrBundled = data;
    } catch {
      remoteOrBundled = getBundledCatalog();
    }
  }

  return mergeCatalogs(hub, remoteOrBundled);
}

/**
 * Install from catalog entry: try downloadUrl, fall back to embedded manifest.
 */
export async function installCatalogEntry(
  entry: CatalogEntry,
): Promise<ExtensionManifest> {
  // Local hub packages are embedded; skip network for hub:// URLs.
  if (entry.downloadUrl.startsWith("hub://") && entry.fallback) {
    return validateManifest(entry.fallback as never, entry.downloadUrl);
  }
  try {
    return await loadExtensionFromUrl(entry.downloadUrl);
  } catch (primary) {
    if (entry.fallback) {
      return validateManifest(entry.fallback as never, entry.downloadUrl);
    }
    throw primary instanceof Error
      ? primary
      : new Error("Failed to install extension.");
  }
}
