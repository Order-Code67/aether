import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/lib/tauri";

export type BplaStudioInfo = {
  installed: boolean;
  path: string | null;
};

/** GitHub / docs placeholder until releases are published. */
export const BPLA_STUDIO_DOWNLOAD_HINT =
  "Build with: npm run studio:build — or set AETHER_BPLA_STUDIO to the .exe path.";

export async function detectBplaStudio(): Promise<BplaStudioInfo> {
  if (!isTauriRuntime()) {
    return { installed: false, path: null };
  }
  return invoke<BplaStudioInfo>("bpla_studio_detect");
}

export async function openBplaStudio(opts?: {
  port?: string;
  baud?: number;
}): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error("BPLA_STUDIO_DESKTOP_REQUIRED");
  }
  await invoke("open_bpla_studio", {
    port: opts?.port ?? null,
    baud: opts?.baud ?? null,
  });
}
