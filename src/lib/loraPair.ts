/**
 * Open LoRa TX + RX bundled examples as a paired Arduino radio workspace.
 */

import { materializeBundledExample } from "@/lib/examples";
import { syncLoraRegionFlagsInIni } from "@/lib/loraIniSync";
import { joinPath } from "@/lib/paths";
import type { LoraRegionId } from "@/lib/loraRegions";
import { isTauriRuntime } from "@/lib/tauri";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

export type LoraPairResult = {
  txPath: string;
  rxPath: string;
  env: string;
  region: LoraRegionId;
};

export type OpenLoraPairOptions = {
  env?: string;
  region?: LoraRegionId;
};

let lastPair: LoraPairResult | null = null;

export function getLastLoraPair(): LoraPairResult | null {
  return lastPair;
}

async function applyRegionToProjectIni(
  projectPath: string,
  region: LoraRegionId,
): Promise<void> {
  if (!isTauriRuntime()) return;
  const iniPath = joinPath(projectPath, "platformio.ini");
  try {
    const text = await readTextFile(iniPath);
    const next = syncLoraRegionFlagsInIni(text, region);
    if (next !== text) await writeTextFile(iniPath, next);
  } catch {
    /* best-effort — pair still opens */
  }
}

function rememberEnvs(txPath: string, rxPath: string, env: string): void {
  usePlatformIoStore.setState((s) => ({
    selectedEnv: env,
    selectedEnvByRoot: {
      ...s.selectedEnvByRoot,
      [txPath]: env,
      [rxPath]: env,
    },
  }));
}

/** Materialize TX + RX, open TX as active root, add RX as second folder. */
export async function openLoraTxRxPair(
  envOrOpts: string | OpenLoraPairOptions = "heltec_wifi_lora_32_V3",
): Promise<LoraPairResult> {
  const opts: OpenLoraPairOptions =
    typeof envOrOpts === "string" ? { env: envOrOpts } : envOrOpts;
  const env = opts.env?.trim() || "heltec_wifi_lora_32_V3";
  const region: LoraRegionId = opts.region ?? "EU868";

  const txPath = await materializeBundledExample("esp32-lora-tx");
  const rxPath = await materializeBundledExample("esp32-lora-rx");

  await applyRegionToProjectIni(txPath, region);
  await applyRegionToProjectIni(rxPath, region);

  const ws = useWorkspaceStore.getState();
  await ws.openFolderAt(txPath);
  await ws.addFolderAt(rxPath);
  await usePlatformIoStore.getState().refreshProject();
  rememberEnvs(txPath, rxPath, env);
  void usePlatformIoStore.getState().refreshRadioDoctorTips(env);

  const result: LoraPairResult = { txPath, rxPath, env, region };
  lastPair = result;
  return result;
}

/**
 * Upload TX then RX (active folder switches). Stays on RX for Serial/Plotter.
 * Uses per-root upload ports when set.
 */
export async function flashLoraPairBoth(
  pair?: LoraPairResult | null,
): Promise<LoraPairResult> {
  const target = pair ?? lastPair;
  if (!target) {
    throw new Error("Open a LoRa TX+RX pair first.");
  }

  const ws = useWorkspaceStore.getState();
  const pio = usePlatformIoStore.getState();

  ws.setActiveFolder(target.txPath);
  rememberEnvs(target.txPath, target.rxPath, target.env);
  await pio.refreshProject();
  await usePlatformIoStore.getState().runTask("upload");
  if (usePlatformIoStore.getState().lastSuccess === false) {
    throw new Error("TX upload failed");
  }

  ws.setActiveFolder(target.rxPath);
  rememberEnvs(target.txPath, target.rxPath, target.env);
  await usePlatformIoStore.getState().refreshProject();
  await usePlatformIoStore.getState().runTask("upload");
  if (usePlatformIoStore.getState().lastSuccess === false) {
    throw new Error("RX upload failed");
  }

  return target;
}

/** Materialize LoRaWAN OTAA stub (Join + uplink path). */
export async function openLorawanJoinExample(
  env = "heltec_wifi_lora_32_V3",
  region: LoraRegionId = "EU868",
): Promise<string> {
  const path = await materializeBundledExample("esp32-lorawan-stub");
  await applyRegionToProjectIni(path, region);
  const ws = useWorkspaceStore.getState();
  await ws.openFolderAt(path);
  await usePlatformIoStore.getState().refreshProject();
  usePlatformIoStore.getState().setSelectedEnv(env);
  return path;
}
