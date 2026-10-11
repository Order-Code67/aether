import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/hooks/useI18n";

export function StubTab({ title }: { title: string }) {
  const { t } = useI18n();
  return (
    <Card className="max-w-2xl">
      <CardTitle>{title}</CardTitle>
      <CardHint className="mt-2">{t("stub.title")}</CardHint>
      <p className="mt-3 text-sm leading-relaxed text-fg-muted">{t("stub.body")}</p>
    </Card>
  );
}
