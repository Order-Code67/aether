import { useEffect, useState } from "react";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/hooks/useI18n";

export function AboutTab() {
  const { t } = useI18n();
  const [version, setVersion] = useState("0.1.0");

  useEffect(() => {
    void window.aether?.app.getVersion().then(setVersion);
  }, []);

  return (
    <Card className="max-w-2xl">
      <div className="flex items-start gap-4">
        <img src="/branding/logo.svg" alt="" className="h-16 w-16" />
        <div>
          <CardTitle className="font-display text-xl">
            {t("about.title")}
          </CardTitle>
          <CardHint className="mt-2 leading-relaxed">{t("about.body")}</CardHint>
          <p className="mt-4 text-sm">
            {t("about.version")}: <strong>{version}</strong>
          </p>
          <p className="mt-2 text-xs text-fg-muted">{t("about.stack")}</p>
        </div>
      </div>
    </Card>
  );
}
