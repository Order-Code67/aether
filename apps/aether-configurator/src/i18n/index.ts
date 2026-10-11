import { en, type MessageKey } from "./en";
import { ru } from "./ru";
import type { Locale } from "@/stores/uiStore";

const catalogs = { en, ru } as const;

export function t(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  let text: string = catalogs[locale][key] ?? en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

export type { MessageKey };
