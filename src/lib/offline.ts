/** Offline detection helpers (navigator.onLine + short connectivity probe). */

export const HTTP_TIMEOUT_MS = 4500;
export const OFFLINE_PROBE_MS = 3000;

export class TimeoutError extends Error {
  constructor(message = "Request timed out.") {
    super(message);
    this.name = "TimeoutError";
  }
}

/** Race a promise against a timeout; rejects with TimeoutError. */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message = "Request timed out.",
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

/** Fetch with AbortController timeout (preferred for HTTP). */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  ms: number = HTTP_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
      cache: init?.cache ?? "no-store",
    });
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === "AbortError" || error.name === "TimeoutError")
    ) {
      throw new TimeoutError("Network request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Best-effort connectivity probe. Uses navigator.onLine first, then a tiny
 * HTTPS fetch that fails fast when DNS/TLS/routing is unavailable.
 */
export async function probeOnline(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return false;
  }
  try {
    // generate_204 returns 204 when reachable; any network error ⇒ offline.
    await fetchWithTimeout(
      "https://www.gstatic.com/generate_204",
      { method: "GET", mode: "no-cors" },
      OFFLINE_PROBE_MS,
    );
    return true;
  } catch {
    return false;
  }
}

export function readNavigatorOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}
