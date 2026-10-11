import { Moon, Sun, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/hooks/useI18n";
import { useUiStore } from "@/stores/uiStore";

export function TitleBar() {
  const { t } = useI18n();
  const locale = useUiStore((s) => s.locale);
  const theme = useUiStore((s) => s.theme);
  const setLocale = useUiStore((s) => s.setLocale);
  const setTheme = useUiStore((s) => s.setTheme);

  return (
    <header className="flex items-center justify-between gap-3 border-b border-border bg-surface/40 px-4 py-2">
      <div>
        <h1 className="font-display text-lg font-semibold tracking-tight text-fg">
          {t("app.name")}
        </h1>
        <p className="text-[11px] text-fg-muted">{t("app.tagline")}</p>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          onClick={() => setLocale(locale === "ru" ? "en" : "ru")}
          title="Language"
        >
          <Languages className="h-3.5 w-3.5" />
          {locale.toUpperCase()}
        </Button>
        <Button
          variant="ghost"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={theme === "dark" ? t("theme.light") : t("theme.dark")}
        >
          {theme === "dark" ? (
            <Sun className="h-3.5 w-3.5" />
          ) : (
            <Moon className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </header>
  );
}
