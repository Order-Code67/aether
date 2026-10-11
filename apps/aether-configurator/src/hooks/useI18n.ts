import { useUiStore } from "@/stores/uiStore";
import { t, type MessageKey } from "@/i18n";

export function useI18n() {
  const locale = useUiStore((s) => s.locale);
  return {
    locale,
    t: (key: MessageKey, vars?: Record<string, string | number>) =>
      t(locale, key, vars),
  };
}
