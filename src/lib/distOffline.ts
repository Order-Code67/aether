/** Match Aether portable offline zip filenames (USB / release sidecar layout). */

export type OfflineZipKind = "full" | "libs";

export function classifyAetherOfflineZipName(
  fileName: string,
): OfflineZipKind | null {
  const lower = fileName.trim().toLowerCase();
  if (!lower.endsWith(".zip")) return null;
  if (
    lower.startsWith("aether_offlinecache_") ||
    lower.startsWith("aether_offlinecache.")
  ) {
    return "full";
  }
  if (
    lower.startsWith("aether_offlinelibs_") ||
    lower.startsWith("aether_offlinelibs.")
  ) {
    return "libs";
  }
  return null;
}

export function pickPreferredSidecarZip(
  zips: { path: string; kind: OfflineZipKind | string }[],
): { path: string; kind: OfflineZipKind | string } | null {
  if (zips.length === 0) return null;
  const full = zips.find((z) => z.kind === "full");
  return full ?? zips[0] ?? null;
}
