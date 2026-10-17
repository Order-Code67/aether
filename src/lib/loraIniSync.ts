/**
 * Sync LoRa region build_flags across PlatformIO envs (TX/RX pair).
 */

import {
  getLoraRegion,
  type LoraRegionId,
} from "@/lib/loraRegions";

/** Rewrite AETHER_LORA_REGION_* and AETHER_LORA_FREQ in every env block. */
export function syncLoraRegionFlagsInIni(
  iniText: string,
  regionId: LoraRegionId | string,
): string {
  const region = getLoraRegion(regionId);
  const regionFlag = `-DAETHER_LORA_REGION_${region.id}`;
  const freqFlag = `-DAETHER_LORA_FREQ=${region.freqMhz}`;
  return iniText
    .replace(/-DAETHER_LORA_REGION_\w+/g, regionFlag)
    .replace(/-DAETHER_LORA_FREQ=[^\s\r\n]+/g, freqFlag);
}

/** Detect region id from ini build_flags (first match). */
export function regionIdFromIni(iniText: string): LoraRegionId | null {
  const m = iniText.match(/-DAETHER_LORA_REGION_(EU868|US915|RU864)/);
  return (m?.[1] as LoraRegionId | undefined) ?? null;
}
