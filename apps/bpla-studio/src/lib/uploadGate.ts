import {
  classifyComDriverIssue,
  type ComDriverIssueKind,
} from "@/lib/comDrivers";

export type SerialReleaseTarget = {
  connected: boolean;
  disconnect: () => Promise<void>;
};

export type SerialReleaseResult =
  | "released"
  | "already-free"
  | "release-failed";

/** Disconnect Serial Monitor before upload so the COM port can be opened. */
export async function releaseSerialBeforeUpload(
  serial: SerialReleaseTarget,
): Promise<SerialReleaseResult> {
  if (!serial.connected) return "already-free";
  try {
    await serial.disconnect();
    return "released";
  } catch {
    return "release-failed";
  }
}

/** Errors that warrant a single disconnect + upload retry. */
export function isRetryableUploadPortError(message: string): boolean {
  const kind: ComDriverIssueKind = classifyComDriverIssue(message);
  if (kind === "access_denied" || kind === "open_failed") return true;
  const lower = message.trim().toLowerCase();
  if (!lower) return false;
  return (
    lower.includes("access denied") ||
    lower.includes("access is denied") ||
    lower.includes("permission denied") ||
    lower.includes("resource busy") ||
    lower.includes("port busy") ||
    lower.includes("failed to open") ||
    lower.includes("could not open port") ||
    lower.includes("serialexception") ||
    lower.includes("порт занят") ||
    lower.includes("доступ запрещён") ||
    lower.includes("не удалось открыть com")
  );
}

/** Pure policy: retry upload once after a port conflict / open failure. */
export function shouldRetryUploadOnPortError(opts: {
  task: string | null | undefined;
  running: boolean;
  success: boolean | null | undefined;
  alreadyRetried: boolean;
  errorText: string;
}): boolean {
  if (opts.running) return false;
  if (opts.success !== false) return false;
  if (opts.task !== "upload") return false;
  if (opts.alreadyRetried) return false;
  return isRetryableUploadPortError(opts.errorText);
}

export function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
