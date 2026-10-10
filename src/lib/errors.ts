/** Extract a readable message from Tauri invoke / DOM / unknown errors. */
export function errorMessage(err: unknown, fallback = "Error"): string {
  if (err == null) return fallback;
  if (typeof err === "string") {
    const trimmed = err.trim();
    return trimmed || fallback;
  }
  if (err instanceof Error) {
    const trimmed = err.message.trim();
    return trimmed || fallback;
  }
  if (typeof err === "object") {
    const obj = err as Record<string, unknown>;
    for (const key of ["message", "error", "msg"]) {
      const value = obj[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    try {
      const json = JSON.stringify(err);
      if (json && json !== "{}" && json !== "null") return json;
    } catch {
      // ignore
    }
  }
  return fallback;
}
