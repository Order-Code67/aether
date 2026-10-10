import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { isTauriRuntime } from "@/lib/tauri";

export type UpdateProgress = {
  downloaded: number;
  contentLength: number | null;
};

export type UpdateCheckResult =
  | { kind: "unavailable" }
  | { kind: "uptodate" }
  | { kind: "available"; update: Update }
  | { kind: "error"; message: string };

export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  if (!isTauriRuntime()) {
    return {
      kind: "error",
      message: "Updates require the desktop app (npm run tauri:dev / release build).",
    };
  }
  try {
    const update = await check();
    if (!update) return { kind: "uptodate" };
    return { kind: "available", update };
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

export async function downloadAndInstallUpdate(
  update: Update,
  onProgress?: (p: UpdateProgress) => void,
): Promise<void> {
  let downloaded = 0;
  let contentLength: number | null = null;

  await update.downloadAndInstall((event: DownloadEvent) => {
    switch (event.event) {
      case "Started":
        contentLength = event.data.contentLength ?? null;
        downloaded = 0;
        onProgress?.({ downloaded, contentLength });
        break;
      case "Progress":
        downloaded += event.data.chunkLength;
        onProgress?.({ downloaded, contentLength });
        break;
      case "Finished":
        onProgress?.({ downloaded, contentLength });
        break;
    }
  });
}

export async function relaunchApp(): Promise<void> {
  await relaunch();
}
