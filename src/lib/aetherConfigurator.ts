import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/lib/tauri";

export type AetherConfiguratorInfo = {
  installed: boolean;
  path: string | null;
};

/** Build / env hint until packaged releases ship next to Aether. */
export const AETHER_CONFIGURATOR_HINT =
  "Build with: npm run configurator:package — or set AETHER_CONFIGURATOR to the .exe path.";

export async function detectAetherConfigurator(): Promise<AetherConfiguratorInfo> {
  if (!isTauriRuntime()) {
    return { installed: false, path: null };
  }
  return invoke<AetherConfiguratorInfo>("aether_configurator_detect");
}

export async function openAetherConfigurator(opts?: {
  port?: string;
  baud?: number;
}): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error("AETHER_CONFIGURATOR_DESKTOP_REQUIRED");
  }
  await invoke("open_aether_configurator", {
    port: opts?.port ?? null,
    baud: opts?.baud ?? null,
  });
}
