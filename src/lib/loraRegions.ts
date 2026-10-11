/** LoRa / LoRaWAN regional frequency presets used by wizard and examples. */

export type LoraRegionId = "EU868" | "US915" | "RU864";

export interface LoraRegion {
  id: LoraRegionId;
  /** Center / first channel MHz for point-to-point RadioLib sketches. */
  freqMhz: number;
  labelEn: string;
  labelRu: string;
  /** MCCI LMIC / LoRaWAN CFG_* style hint */
  lmicCfg: string;
}

export const LORA_REGIONS: LoraRegion[] = [
  {
    id: "EU868",
    freqMhz: 868.1,
    labelEn: "EU868 (868.1 MHz)",
    labelRu: "EU868 (868,1 МГц)",
    lmicCfg: "CFG_eu868",
  },
  {
    id: "US915",
    freqMhz: 915.0,
    labelEn: "US915 (915.0 MHz)",
    labelRu: "US915 (915,0 МГц)",
    lmicCfg: "CFG_us915",
  },
  {
    id: "RU864",
    freqMhz: 864.1,
    labelEn: "RU864 (864.1 MHz)",
    labelRu: "RU864 (864,1 МГц)",
    lmicCfg: "CFG_ru864",
  },
];

export function getLoraRegion(id: string | null | undefined): LoraRegion {
  return LORA_REGIONS.find((r) => r.id === id) ?? LORA_REGIONS[0]!;
}

export function loraRegionBuildFlags(
  region: LoraRegion,
  sf = 7,
  bwKhz = 125.0,
): string[] {
  return [
    `-DAETHER_LORA_REGION_${region.id}`,
    `-DAETHER_LORA_FREQ=${region.freqMhz}`,
    `-DAETHER_LORA_SF=${sf}`,
    `-DAETHER_LORA_BW=${bwKhz}`,
  ];
}
