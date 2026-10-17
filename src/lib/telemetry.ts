/**
 * Opt-in local telemetry scaffold.
 *
 * Default OFF (settingsStore.telemetryOptIn). When enabled, events go to an
 * in-memory ring buffer + sessionStorage — never to a remote server here.
 *
 * See docs/TELEMETRY.md.
 */

import { useSettingsStore } from "@/stores/settingsStore";

export type TelemetryEventName =
  | "build_fail"
  | "upload_fail"
  | "telemetry_toggle";

export type TelemetryEvent = {
  name: TelemetryEventName;
  at: number;
  /** Non-PII context only (task id, short error class). */
  props?: Record<string, string | number | boolean>;
};

const MAX_EVENTS = 40;
const STORAGE_KEY = "aether-telemetry-local";

const buffer: TelemetryEvent[] = [];

function sanitizeProps(
  props: NonNullable<TelemetryEvent["props"]>,
): NonNullable<TelemetryEvent["props"]> {
  const out: NonNullable<TelemetryEvent["props"]> = {};
  for (const [k, v] of Object.entries(props)) {
    if (typeof v === "string") {
      if (v.includes("@") || /[A-Za-z]:\\|^\//.test(v) || v.length > 120) {
        out[k] = "[redacted]";
        continue;
      }
    }
    out[k] = v;
  }
  return out;
}

function persistLocal(): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(buffer.slice(-MAX_EVENTS)),
    );
  } catch {
    // ignore quota / private mode
  }
}

/** Record a local event when opt-in is on; no-op otherwise. Never ships PII. */
export function trackEvent(
  name: TelemetryEventName,
  props?: TelemetryEvent["props"],
): void {
  const optedIn = useSettingsStore.getState().telemetryOptIn;
  if (name === "telemetry_toggle") {
    // Always record the toggle itself locally so support can see the change.
  } else if (!optedIn) {
    return;
  }

  const event: TelemetryEvent = {
    name,
    at: Date.now(),
    props: props ? sanitizeProps(props) : undefined,
  };
  buffer.push(event);
  if (buffer.length > MAX_EVENTS) buffer.splice(0, buffer.length - MAX_EVENTS);
  persistLocal();
}

/** Snapshot for support/debug (local only). */
export function getLocalTelemetryEvents(): readonly TelemetryEvent[] {
  return buffer.slice();
}

export function clearLocalTelemetry(): void {
  buffer.length = 0;
  try {
    sessionStorage?.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Call on build/upload failure — no-op unless Settings → telemetry is on. */
export function trackBuildOrUploadFail(
  task: "build" | "upload",
  opts?: { tool?: string; errorClass?: string },
): void {
  trackEvent(task === "upload" ? "upload_fail" : "build_fail", {
    task,
    tool: opts?.tool ?? "unknown",
    errorClass: opts?.errorClass ?? "fail",
  });
}
