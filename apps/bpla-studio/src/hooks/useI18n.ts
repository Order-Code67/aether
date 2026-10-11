import { useCallback } from "react";
import { translate, type MessageKey } from "@/i18n";
import { useSettingsStore } from "@/stores/settingsStore";

export function useI18n() {
  const locale = useSettingsStore((s) => s.locale);
  const setLocale = useSettingsStore((s) => s.setLocale);
  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) =>
      translate(locale, key, vars),
    [locale],
  );
  return { t, locale, setLocale };
}

export function t(key: MessageKey, vars?: Record<string, string | number>) {
  return translate(useSettingsStore.getState().locale, key, vars);
}
