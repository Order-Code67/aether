/**
 * Built-in hardware presets: open a bundled example with the right env.
 * Complements user firmware profiles (port snapshots).
 */

export interface HardwareProfilePreset {
  id: string;
  /** Bundled example id under resources/examples; null = BPLA-only path */
  exampleId: string | null;
  env: string;
  board: string;
  labelEn: string;
  labelRu: string;
  tags: string[];
  /**
   * `example` — materialize sketch + set env (libs via platformio.ini).
   * `bpla` — open БПЛА / Aether Configurator path (optional stub example).
   */
  kind?: "example" | "bpla";
  /** Highlight on Welcome / onboarding as a one-click template. */
  featured?: boolean;
}

export const HARDWARE_PROFILE_PRESETS: HardwareProfilePreset[] = [
  {
    id: "heltec-v3",
    exampleId: "esp32-lora-tx",
    env: "heltec_wifi_lora_32_V3",
    board: "heltec_wifi_lora_32_V3",
    labelEn: "Heltec WiFi LoRa 32 V3",
    labelRu: "Heltec WiFi LoRa 32 V3",
    tags: ["LoRa", "ESP32", "SX1262"],
    featured: true,
  },
  {
    id: "heltec-v2",
    exampleId: "esp32-lora-tx",
    env: "heltec_wifi_lora_32_V2",
    board: "heltec_wifi_lora_32_V2",
    labelEn: "Heltec WiFi LoRa 32 V2",
    labelRu: "Heltec WiFi LoRa 32 V2",
    tags: ["LoRa", "ESP32", "SX1276"],
  },
  {
    id: "t-beam",
    exampleId: "esp32-lora-tx",
    env: "ttgo-t-beam",
    board: "ttgo-t-beam",
    labelEn: "LilyGO T-Beam",
    labelRu: "LilyGO T-Beam",
    tags: ["LoRa", "ESP32", "GPS"],
    featured: true,
  },
  {
    id: "ttgo-lora32-v2",
    exampleId: "esp32-lora-tx",
    env: "ttgo-lora32-v2",
    board: "ttgo-lora32-v2",
    labelEn: "TTGO LoRa32 V2",
    labelRu: "TTGO LoRa32 V2",
    tags: ["LoRa", "ESP32"],
  },
  {
    id: "mega-sx1276",
    exampleId: "arduino-mega-lora",
    env: "megaatmega2560",
    board: "megaatmega2560",
    labelEn: "Mega + SX1276 / RFM95",
    labelRu: "Mega + SX1276 / RFM95",
    tags: ["LoRa", "Mega"],
    featured: true,
  },
  {
    id: "fc-bpla",
    exampleId: "pixhawk-ardupilot-stub",
    env: "sitl_notes",
    board: "fc",
    labelEn: "FC / BPLA (Configurator)",
    labelRu: "FC / БПЛА (Configurator)",
    tags: ["FC", "MSP", "BPLA"],
    kind: "bpla",
    featured: true,
  },
];

export function featuredHardwarePresets(): HardwareProfilePreset[] {
  return HARDWARE_PROFILE_PRESETS.filter((p) => p.featured);
}

export function getHardwarePreset(
  id: string,
): HardwareProfilePreset | undefined {
  return HARDWARE_PROFILE_PRESETS.find((p) => p.id === id);
}
