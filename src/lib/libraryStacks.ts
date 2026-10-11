/** One-click multi-library stacks for the Libraries panel. */

export type StackPlatform = "all" | "arduino" | "esp32" | "nano" | "mega";

export interface LibraryStack {
  id: string;
  /** i18n key for label */
  labelKey:
    | "libraries.stack.lora"
    | "libraries.stack.meshtastic"
    | "libraries.stack.espnow";
  platforms: StackPlatform[];
  specs: string[];
}

export const LIBRARY_STACKS: LibraryStack[] = [
  {
    id: "lora",
    labelKey: "libraries.stack.lora",
    platforms: ["all", "esp32", "mega", "arduino"],
    specs: [
      "jgromes/RadioLib",
      "bblanchon/ArduinoJson",
      "adafruit/Adafruit GFX Library",
      "adafruit/Adafruit SSD1306",
      "adafruit/Adafruit BusIO",
      "olikraus/U8g2",
    ],
  },
  {
    id: "meshtastic",
    labelKey: "libraries.stack.meshtastic",
    platforms: ["all", "esp32"],
    specs: [
      "jgromes/RadioLib",
      "bblanchon/ArduinoJson",
      "adafruit/Adafruit SSD1306",
      "adafruit/Adafruit BusIO",
      "olikraus/U8g2",
    ],
  },
  {
    id: "espnow",
    labelKey: "libraries.stack.espnow",
    platforms: ["all", "esp32"],
    /** ESP-NOW is in the ESP32 Arduino core; pull helpers only. */
    specs: ["bblanchon/ArduinoJson"],
  },
];

export function stacksForPlatform(platform: StackPlatform): LibraryStack[] {
  return LIBRARY_STACKS.filter(
    (s) => s.platforms.includes("all") || s.platforms.includes(platform),
  );
}
