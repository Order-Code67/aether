/** Offline detection helpers (navigator.onLine + short connectivity probe). */

export const HTTP_TIMEOUT_MS = 4500;
export const OFFLINE_PROBE_MS = 2500;

/** Endpoints that return quickly when reachable (any response counts as online). */
const PROBE_URLS = [
  "https://www.gstatic.com/generate_204",
  "https://connectivitycheck.gstatic.com/generate_204",
  "https://www.msftconnecttest.com/connecttest.txt",
  "https://cloudflare.com/cdn-cgi/trace",
] as const;

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

async function probeOne(url: string): Promise<boolean> {
  try {
    await fetchWithTimeout(
      url,
      { method: "GET", mode: "no-cors" },
      OFFLINE_PROBE_MS,
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Best-effort connectivity probe. Uses navigator.onLine first, then tries
 * several tiny HTTPS fetches (any success ⇒ online). Probe failures alone
 * must not hard-block AI — many WebViews / regions block these hosts while
 * the LLM API still works.
 */
export async function probeOnline(): Promise<boolean> {
  if (!readNavigatorOnline()) {
    return false;
  }
  const results = await Promise.all(PROBE_URLS.map((url) => probeOne(url)));
  return results.some(Boolean);
}

/** True only when the browser reports offline (hard signal). */
export function isNavigatorOffline(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.onLine === false;
}

export function readNavigatorOnline(): boolean {
  return !isNavigatorOffline();
}

/**
 * Hard gate for features that must not start without a link.
 * Soft/probe offline (`isAppOffline`) is intentionally separate.
 */
export function shouldHardBlockNetwork(): boolean {
  return isNavigatorOffline();
}
