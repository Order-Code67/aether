/**
 * Open LoRa TX + RX bundled examples as a paired Arduino radio workspace.
 */

import { materializeBundledExample } from "@/lib/examples";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export type LoraPairResult = {
  txPath: string;
  rxPath: string;
  env: string;
};

/** Materialize TX + RX, open TX as active root, add RX as second folder. */
export async function openLoraTxRxPair(env = "heltec_wifi_lora_32_V3"): Promise<LoraPairResult> {
  const txPath = await materializeBundledExample("esp32-lora-tx");
  const rxPath = await materializeBundledExample("esp32-lora-rx");
  const ws = useWorkspaceStore.getState();
  await ws.openFolderAt(txPath);
  await ws.addFolderAt(rxPath);
  await usePlatformIoStore.getState().refreshProject();
  usePlatformIoStore.getState().setSelectedEnv(env);
  return { txPath, rxPath, env };
}
