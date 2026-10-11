/**
 * Pure helpers for iNav / Betaflight-style CLI diff text.
 */

/** Strip CR and normalize newlines. */
export function normalizeCliText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * Split a saved diff / CLI dump into lines suitable for sending to the FC.
 * Drops empty lines and `#` comment-only lines; keeps `set` / bare CLI commands.
 */
export function splitDiffForCliSend(text: string): string[] {
  const normalized = normalizeCliText(text);
  return normalized
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      if (t.startsWith("#")) return false;
      return true;
    });
}

/** Heuristic: does the buffer look like an iNav/BF CLI diff dump? */
export function looksLikeCliDiff(text: string): boolean {
  const sample = normalizeCliText(text).slice(0, 4000).toLowerCase();
  if (!sample.trim()) return false;
  return (
    sample.includes("\nset ") ||
    sample.startsWith("set ") ||
    sample.includes("# version") ||
    sample.includes("# start") ||
    sample.includes("batch start") ||
    sample.includes("\ndiff") ||
    /\bprofile\b/.test(sample)
  );
}

/** Suggested filename stem for a saved diff. */
export function suggestDiffFileStem(portLabel?: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const port = (portLabel ?? "fc")
    .replace(/[<>:"|?*\\/]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 32);
  return `inav-diff-${port}-${stamp}`;
}
