export function pathSeparator(path: string): "/" | "\\" {
  return path.includes("\\") ? "\\" : "/";
}

export function joinPath(dir: string, name: string): string {
  const sep = pathSeparator(dir);
  if (dir.endsWith("/") || dir.endsWith("\\")) {
    return `${dir}${name}`;
  }
  return `${dir}${sep}${name}`;
}

export function basename(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export function dirname(path: string): string {
  const sep = pathSeparator(path);
  const normalized = path.replace(/[/\\]+$/, "");
  const idx = Math.max(
    normalized.lastIndexOf("/"),
    normalized.lastIndexOf("\\"),
  );
  if (idx <= 0) {
    // Windows drive root like C:\
    if (/^[A-Za-z]:$/i.test(normalized)) return `${normalized}${sep}`;
    return normalized;
  }
  if (/^[A-Za-z]:$/i.test(normalized.slice(0, idx))) {
    return normalized.slice(0, idx + 1);
  }
  return normalized.slice(0, idx);
}

/** Reject names that would escape the parent directory. */
export function isValidEntryName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed || trimmed === "." || trimmed === "..") return false;
  if (/[<>:"|?*\u0000-\u001f]/.test(trimmed)) return false;
  if (trimmed.includes("/") || trimmed.includes("\\")) return false;
  return true;
}

export function workspaceLabel(rootPath: string | null): string {
  if (!rootPath) return "No folder";
  return basename(rootPath).toUpperCase();
}

/** Case-insensitive path equality for Windows. */
export function pathsEqual(a: string, b: string): boolean {
  return a.replace(/\//g, "\\").toLowerCase() === b.replace(/\//g, "\\").toLowerCase();
}
