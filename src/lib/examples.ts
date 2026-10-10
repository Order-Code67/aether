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
