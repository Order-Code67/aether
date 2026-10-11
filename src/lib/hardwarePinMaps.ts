/**
 * Curated SPI / OLED pin maps for common LoRa boards.
 * Keys match PlatformIO `board` / env ids where possible.
 */

export interface LoraPinMap {
  id: string;
  label: string;
  /** Radio chip family for sketch hints */
  radio: "SX127x" | "SX126x" | "RFM95";
  nss: number;
  /** DIO0 (SX127x) or DIO1 (SX126x) */
  dio: number;
  rst: number;
  /** SX126x busy; -1 if unused */
  busy: number;
  sck: number;
  miso: number;
  mosi: number;
  oledSda: number | null;
  oledScl: number | null;
  oledRst: number | null;
}

export const LORA_PIN_MAPS: Record<string, LoraPinMap> = {
  heltec_wifi_lora_32_V2: {
    id: "heltec_wifi_lora_32_V2",
    label: "Heltec WiFi LoRa 32 V2",
    radio: "SX127x",
    nss: 18,
    dio: 26,
    rst: 14,
    busy: -1,
    sck: 5,
    miso: 19,
    mosi: 27,
    oledSda: 4,
    oledScl: 15,
    oledRst: 16,
  },
  heltec_wifi_lora_32_V3: {
    id: "heltec_wifi_lora_32_V3",
    label: "Heltec WiFi LoRa 32 V3",
    radio: "SX126x",
    nss: 8,
    dio: 14,
    rst: 12,
    busy: 13,
    sck: 9,
    miso: 11,
    mosi: 10,
    oledSda: 17,
    oledScl: 18,
    oledRst: 21,
  },
  "ttgo-lora32-v1": {
    id: "ttgo-lora32-v1",
    label: "LilyGO TTGO LoRa32 V1",
    radio: "SX127x",
    nss: 18,
    dio: 26,
    rst: 14,
    busy: -1,
    sck: 5,
    miso: 19,
    mosi: 27,
    oledSda: 4,
    oledScl: 15,
    oledRst: null,
  },
  "ttgo-lora32-v2": {
    id: "ttgo-lora32-v2",
    label: "LilyGO TTGO LoRa32 V2",
    radio: "SX127x",
    nss: 18,
    dio: 26,
    rst: 14,
    busy: -1,
    sck: 5,
    miso: 19,
    mosi: 27,
    oledSda: 21,
    oledScl: 22,
    oledRst: 16,
  },
  "ttgo-t-beam": {
    id: "ttgo-t-beam",
    label: "LilyGO T-Beam",
    radio: "SX127x",
    nss: 18,
    dio: 26,
    rst: 23,
    busy: -1,
    sck: 5,
    miso: 19,
    mosi: 27,
    oledSda: 21,
    oledScl: 22,
    oledRst: null,
  },
  esp32dev: {
    id: "esp32dev",
    label: "ESP32 Dev + external LoRa",
    radio: "SX127x",
    nss: 5,
    dio: 26,
    rst: 14,
    busy: -1,
    sck: 18,
    miso: 19,
    mosi: 23,
    oledSda: 21,
    oledScl: 22,
    oledRst: null,
  },
  megaatmega2560: {
    id: "megaatmega2560",
    label: "Arduino Mega + RFM95 / SX1276",
    radio: "RFM95",
    nss: 10,
    dio: 2,
    rst: 9,
    busy: -1,
    sck: 52,
    miso: 50,
    mosi: 51,
    oledSda: 20,
    oledScl: 21,
    oledRst: null,
  },
};

/** Resolve pin map from PlatformIO env or board id. */
export function resolveLoraPinMap(
  envOrBoard: string | null | undefined,
): LoraPinMap | null {
  if (!envOrBoard) return null;
  const key = envOrBoard.trim();
  if (LORA_PIN_MAPS[key]) return LORA_PIN_MAPS[key]!;
  const lower = key.toLowerCase();
  for (const [id, map] of Object.entries(LORA_PIN_MAPS)) {
    if (lower.includes(id.toLowerCase()) || id.toLowerCase().includes(lower)) {
      return map;
    }
  }
  if (/heltec.*v3|v3.*heltec/i.test(key)) {
    return LORA_PIN_MAPS.heltec_wifi_lora_32_V3!;
  }
  if (/heltec/i.test(key)) return LORA_PIN_MAPS.heltec_wifi_lora_32_V2!;
  if (/t-?beam/i.test(key)) return LORA_PIN_MAPS["ttgo-t-beam"]!;
  if (/ttgo|lora32/i.test(key)) return LORA_PIN_MAPS["ttgo-lora32-v2"]!;
  if (/mega/i.test(key)) return LORA_PIN_MAPS.megaatmega2560!;
  return null;
}

export function formatPinMapForPrompt(map: LoraPinMap): string {
  const oled =
    map.oledSda != null && map.oledScl != null
      ? `OLED SDA=${map.oledSda} SCL=${map.oledScl}${
          map.oledRst != null ? ` RST=${map.oledRst}` : ""
        }`
      : "OLED: n/a";
  return [
    `Board: ${map.label} (${map.id})`,
    `Radio: ${map.radio}`,
    `SPI: NSS=${map.nss} SCK=${map.sck} MISO=${map.miso} MOSI=${map.mosi}`,
    `Control: DIO=${map.dio} RST=${map.rst} BUSY=${map.busy}`,
    oled,
  ].join("\n");
}

export function pinMapBuildFlags(map: LoraPinMap): string[] {
  const flags = [
    `-DAETHER_LORA_NSS=${map.nss}`,
    `-DAETHER_LORA_DIO=${map.dio}`,
    `-DAETHER_LORA_RST=${map.rst}`,
    `-DAETHER_LORA_BUSY=${map.busy}`,
    `-DAETHER_LORA_SCK=${map.sck}`,
    `-DAETHER_LORA_MISO=${map.miso}`,
    `-DAETHER_LORA_MOSI=${map.mosi}`,
  ];
  if (map.oledSda != null) flags.push(`-DAETHER_OLED_SDA=${map.oledSda}`);
  if (map.oledScl != null) flags.push(`-DAETHER_OLED_SCL=${map.oledScl}`);
  if (map.oledRst != null) flags.push(`-DAETHER_OLED_RST=${map.oledRst}`);
  if (map.radio === "SX126x") flags.push("-DAETHER_RADIO_SX126X=1");
  else flags.push("-DAETHER_RADIO_SX127X=1");
  return flags;
}
