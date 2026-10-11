import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/hooks/useI18n";
import { useOsdStore } from "@/stores/osdStore";
import { OSD_COLS, OSD_ROWS } from "@/core/protocols/msp/osd";

export function OsdTab() {
  const { t } = useI18n();
  const elements = useOsdStore((s) => s.elements);
  const selected = useOsdStore((s) => s.selected);
  const setSelected = useOsdStore((s) => s.setSelected);
  const move = useOsdStore((s) => s.move);
  const toggleVisible = useOsdStore((s) => s.toggleVisible);
  const reset = useOsdStore((s) => s.reset);
  const exportCli = useOsdStore((s) => s.exportCli);

  const sel = elements.find((e) => e.id === selected) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">{t("osd.title")}</h2>
          <p className="mt-1 max-w-2xl text-sm text-fg-muted">{t("osd.hint")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={reset}>
            {t("osd.reset")}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              void navigator.clipboard.writeText(exportCli());
            }}
          >
            {t("osd.copy")}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
        <Card className="overflow-auto">
          <div
            className="relative mx-auto grid bg-[#0a1a12] font-mono text-[10px] text-[#8fef9a]"
            style={{
              gridTemplateColumns: `repeat(${OSD_COLS}, 1.1rem)`,
              gridTemplateRows: `repeat(${OSD_ROWS}, 1.1rem)`,
              width: `calc(${OSD_COLS} * 1.1rem)`,
            }}
          >
            {Array.from({ length: OSD_COLS * OSD_ROWS }).map((_, i) => (
              <div
                key={i}
                className="border border-white/5"
                onClick={() => {
                  if (!sel) return;
                  const x = i % OSD_COLS;
                  const y = Math.floor(i / OSD_COLS);
                  move(sel.id, x, y);
                }}
              />
            ))}
            {elements
              .filter((e) => e.visible)
              .map((el) => (
                <button
                  key={el.id}
                  type="button"
                  className={`absolute truncate px-0.5 ${
                    selected === el.id ? "bg-accent/40 text-fg" : "bg-black/40"
                  }`}
                  style={{
                    left: `calc(${el.x} * 1.1rem)`,
                    top: `calc(${el.y} * 1.1rem)`,
                    maxWidth: "8rem",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(el.id);
                  }}
                >
                  {el.label}
                </button>
              ))}
          </div>
        </Card>

        <Card>
          <CardTitle>{t("osd.elements")}</CardTitle>
          <CardHint>{t("osd.elementsHint")}</CardHint>
          <ul className="mt-3 space-y-1">
            {elements.map((el) => (
              <li key={el.id}>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs ${
                    selected === el.id ? "bg-accent/15 text-accent" : "hover:bg-surface-2"
                  }`}
                  onClick={() => setSelected(el.id)}
                >
                  <span>{el.label}</span>
                  <Badge tone={el.visible ? "ok" : "neutral"}>
                    {el.visible ? `${el.x},${el.y}` : "off"}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
          {sel && (
            <div className="mt-3 space-y-2 border-t border-border pt-3 text-xs">
              <Button variant="secondary" onClick={() => toggleVisible(sel.id)}>
                {sel.visible ? t("osd.hide") : t("osd.show")}
              </Button>
              <p className="text-fg-muted">{t("osd.clickHint")}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
