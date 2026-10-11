import { invoke } from "@tauri-apps/api/core";
import type { Locale } from "@/i18n";

export interface BundledExample {
  id: string;
  title: string;
  description: string;
  board: string;
  tags: string[];
}

/** Localized catalog overlays (RU/EN) keyed by example id. */
const LOCALIZED: Record<
  string,
  { descEn: string; descRu: string; tags: string[] }
> = {
  "esp32-blink": {
    descEn:
      "Blink the built-in LED on an ESP32 Dev Module. Includes popular lib_deps presets.",
    descRu:
      "Мигание встроенным светодиодом на ESP32 Dev Module. С популярными lib_deps.",
    tags: ["ESP32", "Blink"],
  },
  "arduino-mega-servo": {
    descEn: "Servo sweep sketch for Arduino Mega 2560 with ArduinoJson.",
    descRu: "Скетч сервопривода для Arduino Mega 2560 с ArduinoJson.",
    tags: ["Mega", "Servo"],
  },
  "arduino-nano": {
    descEn: "Blink + Servo starter for Arduino Nano (ATmega328).",
    descRu: "Blink + Servo для Arduino Nano (ATmega328).",
    tags: ["Nano", "Blink", "Servo"],
  },
  "esp32-wifi": {
    descEn:
      "Minimal Wi-Fi connect stub for ESP32. Set SSID/password, then see PlatformIO docs.",
    descRu:
      "Минимальный Wi-Fi stub для ESP32. Укажите SSID/пароль; далее — документация PlatformIO.",
    tags: ["ESP32", "Wi-Fi"],
  },
  "esp32-cam": {
    descEn:
      "AI-Thinker ESP32-CAM: Wi‑Fi + /capture JPEG + /stream MJPEG for Camera panel. Needs stable 5V; set SSID/password first.",
    descRu:
      "AI-Thinker ESP32-CAM: Wi‑Fi + /capture JPEG + /stream MJPEG для панели Камера. Нужен стабильный 5 В; сначала SSID/пароль.",
    tags: ["ESP32", "CAM", "Wi-Fi"],
  },
  "esp32-lora-tx": {
    descEn:
      "RadioLib LoRa TX with pin maps for Heltec V2/V3, TTGO, T-Beam. Pair with LoRa RX; default EU868 (edit for US915/RU864).",
    descRu:
      "RadioLib LoRa TX с картой пинов Heltec V2/V3, TTGO, T-Beam. Пара с LoRa RX; по умолчанию EU868 (US915/RU864 в build_flags).",
    tags: ["ESP32", "LoRa", "TX"],
  },
  "esp32-lora-rx": {
    descEn:
      "RadioLib LoRa RX peer. Same board env, region, SF and bandwidth as LoRa TX.",
    descRu:
      "RadioLib LoRa RX. Тот же env платы, регион, SF и полоса, что у LoRa TX.",
    tags: ["ESP32", "LoRa", "RX"],
  },
  "arduino-mega-lora": {
    descEn:
      "Mega + RFM95/SX1276 on SPI (NSS=10 DIO0=2 RST=9). RadioLib TX/RX; default EU868.",
    descRu:
      "Mega + RFM95/SX1276 по SPI (NSS=10 DIO0=2 RST=9). RadioLib TX/RX; по умолчанию EU868.",
    tags: ["Mega", "LoRa"],
  },
  "esp32-lorawan-stub": {
    descEn:
      "LoRaWAN OTAA: set DevEUI/AppKey, Join, then periodic uplinks (RadioLib). Heltec/TTGO envs; default EU868.",
    descRu:
      "LoRaWAN OTAA: DevEUI/AppKey → Join → периодические uplink (RadioLib). Env Heltec/TTGO; по умолчанию EU868.",
    tags: ["ESP32", "LoRaWAN", "TTN", "OTAA"],
  },
  "esp32-espnow-stub": {
    descEn:
      "ESP-NOW peer stub with ArduinoJson. Set PEER_MAC to the other ESP32.",
    descRu:
      "Заглушка ESP-NOW с ArduinoJson. Укажите PEER_MAC второго ESP32.",
    tags: ["ESP32", "ESP-NOW"],
  },
  "meshtastic-stub": {
    descEn:
      "Meshtastic firmware is not bundled. Use LoRa TX/RX examples or flash official Meshtastic.",
    descRu:
      "Прошивка Meshtastic не входит в комплект. Используйте LoRa TX/RX или официальный Meshtastic.",
    tags: ["Meshtastic", "LoRa", "Stub"],
  },
  "pixhawk-ardupilot-stub": {
    descEn:
      "Stub for Pixhawk / ArduPilot (SITL-oriented notes). Not a full ArduPilot IDE — read the README.",
    descRu:
      "Заглушка для Pixhawk / ArduPilot (заметки про SITL). Это не полноценная IDE ArduPilot — см. README.",
    tags: ["Pixhawk", "ArduPilot", "Stub"],
  },
  "betaflight-espfc-stub": {
    descEn:
      "Later: Betaflight / ESP-FC. Placeholder card only — no heavy firmware tree yet.",
    descRu:
      "Позже: Betaflight / ESP-FC. Только карточка-заглушка — тяжёлое дерево прошивки пока не включено.",
    tags: ["Betaflight", "ESP-FC", "Later"],
  },
};

export function localizeExample(
  ex: BundledExample,
  locale: Locale,
): BundledExample {
  const overlay = LOCALIZED[ex.id];
  if (!overlay) {
    return {
      ...ex,
      tags: ex.tags?.length ? ex.tags : [],
    };
  }
  return {
    ...ex,
    description: locale === "ru" ? overlay.descRu : overlay.descEn,
    tags: overlay.tags,
  };
}

export function listBundledExamples(): Promise<BundledExample[]> {
  return invoke("list_bundled_examples");
}

export function materializeBundledExample(id: string): Promise<string> {
  return invoke("materialize_bundled_example", { id });
}
