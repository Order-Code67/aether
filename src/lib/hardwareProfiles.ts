/**
 * Built-in hardware presets: open a bundled example with the right env.
 * Complements user firmware profiles (port snapshots).
 */

export interface HardwareProfilePreset {
  id: string;
  /** Bundled example id under resources/examples */
  exampleId: string;
  env: string;
  board: string;
  labelEn: string;
  labelRu: string;
  tags: string[];
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
  },
];
