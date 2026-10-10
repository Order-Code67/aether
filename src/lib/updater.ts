import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { relaunch } from "@tauri-apps/plugin-process";
import { isTauriRuntime } from "@/lib/tauri";

export type UpdateChannel = "stable" | "beta";

export type UpdateProgress = {
  downloaded: number;
  contentLength: number | null;
};

export type ChannelUpdateInfo = {
  currentVersion: string;
  version: string;
  date?: string | null;
  body?: string | null;
};

export type UpdateCheckResult =
  | { kind: "unavailable" }
  | { kind: "uptodate" }
  | { kind: "available"; info: ChannelUpdateInfo }
  | { kind: "error"; message: string };

export async function checkForAppUpdate(
  channel: UpdateChannel = "stable",
): Promise<UpdateCheckResult> {
  if (!isTauriRuntime()) {
    return {
      kind: "error",
      message: "Updates require the desktop app (npm run tauri:dev / release build).",
    };
  }
  try {
    const info = await invoke<ChannelUpdateInfo | null>("updater_check_channel", {
      channel,
    });
    if (!info) return { kind: "uptodate" };
    return { kind: "available", info };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to check for updates.";
    // Common when endpoint 404 / network offline during early releases
    if (/404|failed to fetch|error sending request|tls|dns/i.test(message)) {
      return {
        kind: "unavailable",
      };
    }
    return { kind: "error", message };
  }
}

export async function downloadAndInstallPendingUpdate(
  onProgress?: (p: UpdateProgress) => void,
): Promise<UnlistenFn | void> {
  let unlisten: UnlistenFn | undefined;
  if (onProgress) {
    unlisten = await listen<{ downloaded: number; contentLength?: number | null }>(
      "updater-download-progress",
      (event) => {
        onProgress({
          downloaded: event.payload.downloaded,
          contentLength: event.payload.contentLength ?? null,
        });
      },
    );
  }
  try {
    await invoke("updater_install_pending");
  } finally {
    unlisten?.();
  }
}

export async function relaunchApp(): Promise<void> {
  await relaunch();
}
