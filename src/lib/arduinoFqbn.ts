/** Map common PlatformIO `board = …` ids to Arduino CLI FQBN. */
const BOARD_TO_FQBN: Record<string, string> = {
  uno: "arduino:avr:uno",
  uno_r4_minima: "arduino:renesas_uno:minima",
  unor4minima: "arduino:renesas_uno:minima",
  uno_r4_wifi: "arduino:renesas_uno:unor4wifi",
  unor4wifi: "arduino:renesas_uno:unor4wifi",
  nanoatmega328: "arduino:avr:nano",
  nano: "arduino:avr:nano",
  nanoatmega328new: "arduino:avr:nano:cpu=atmega328new",
  megaatmega2560: "arduino:avr:mega",
  mega: "arduino:avr:mega",
  leonardo: "arduino:avr:leonardo",
  micro: "arduino:avr:micro",
  pro16mhzatmega328: "arduino:avr:pro",
  pro: "arduino:avr:pro",
  diecimilaatmega328: "arduino:avr:diecimila",
  esp32dev: "esp32:esp32:esp32",
  "esp32doit-devkit-v1": "esp32:esp32:esp32",
  "esp32-s3-devkitc-1": "esp32:esp32:esp32s3",
  "esp32-c3-devkitm-1": "esp32:esp32:esp32c3",
  heltec_wifi_lora_32: "esp32:esp32:heltec_wifi_lora_32",
  heltec_wifi_lora_32_v2: "esp32:esp32:heltec_wifi_lora_32_V2",
  heltec_wifi_lora_32_V2: "esp32:esp32:heltec_wifi_lora_32_V2",
  heltec_wifi_lora_32_v3: "esp32:esp32:heltec_wifi_lora_32_V3",
  heltec_wifi_lora_32_V3: "esp32:esp32:heltec_wifi_lora_32_V3",
  "ttgo-lora32-v1": "esp32:esp32:ttgo-lora32",
  "ttgo-lora32-v2": "esp32:esp32:ttgo-lora32",
  "ttgo-t-beam": "esp32:esp32:ttgo-lora32",
  nodemcuv2: "esp8266:esp8266:nodemcuv2",
  d1_mini: "esp8266:esp8266:d1_mini",
  esp01_1m: "esp8266:esp8266:generic",
};

export function pioBoardToFqbn(board: string | null | undefined): string | null {
  if (!board) return null;
  const key = board.trim();
  if (!key) return null;
  return (
    BOARD_TO_FQBN[key] ??
    BOARD_TO_FQBN[key.toLowerCase()] ??
    null
  );
}
