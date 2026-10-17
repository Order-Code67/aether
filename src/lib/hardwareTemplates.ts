/**
 * One-click hardware templates: open example + env (+ BPLA path for FC).
 */
import { materializeBundledExample } from "@/lib/examples";
import {
  getHardwarePreset,
  type HardwareProfilePreset,
} from "@/lib/hardwareProfiles";
import { useLayoutStore } from "@/stores/layoutStore";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export type ApplyHardwareTemplateResult = {
  preset: HardwareProfilePreset;
  path: string | null;
};

export async function applyHardwareTemplate(
  presetId: string,
): Promise<ApplyHardwareTemplateResult> {
  const preset = getHardwarePreset(presetId);
  if (!preset) {
    throw new Error(`Unknown hardware template: ${presetId}`);
  }

  let path: string | null = null;
  if (preset.exampleId) {
    path = await materializeBundledExample(preset.exampleId);
    await useWorkspaceStore.getState().openFolderAt(path);
    await usePlatformIoStore.getState().refreshProject();
    if (preset.env) {
      usePlatformIoStore.getState().setSelectedEnv(preset.env);
    }
  }

  if (preset.kind === "bpla") {
    useLayoutStore.getState().setActiveActivity("inav");
  }

  return { preset, path };
}
