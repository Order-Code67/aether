import { en, type MessageKey } from "./locales/en";
import { ru } from "./locales/ru";

export type Locale = "en" | "ru";
export type { MessageKey };

const catalogs: Record<Locale, Record<MessageKey, string>> = { en, ru };

export function detectDefaultLocale(): Locale {
  try {
    const lang = navigator.language?.toLowerCase() ?? "";
    if (lang.startsWith("ru")) return "ru";
  } catch {
    // ignore
  }
  return "en";
}

export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  let text = catalogs[locale]?.[key] ?? catalogs.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}
