import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/hooks/useI18n";
import { useParamsStore } from "@/stores/paramsStore";
import { useConnectionStore } from "@/stores/connectionStore";
import { useCraftStore, CRAFT_OPTIONS } from "@/stores/craftStore";

export function ParametersTab() {
  const { t } = useI18n();
  const connected = useConnectionStore((s) => s.connected);
  const protocol = useConnectionStore((s) => s.protocol);
  const query = useParamsStore((s) => s.query);
  const setQuery = useParamsStore((s) => s.setQuery);
  const busy = useParamsStore((s) => s.busy);
  const notice = useParamsStore((s) => s.notice);
  const error = useParamsStore((s) => s.error);
  const craftLabel = useParamsStore((s) => s.craftLabel);
  const loadCli = useParamsStore((s) => s.loadCli);
  const loadMavlink = useParamsStore((s) => s.loadMavlink);
  const filtered = useParamsStore((s) => s.filtered);
  const groups = useParamsStore((s) => s.groups);
  const craft = useCraftStore((s) => s.kind);
  const setCraft = useCraftStore((s) => s.setCraft);

  const rows = filtered();
  const groupList = groups();

  const banner =
    error === "NOT_CONNECTED"
      ? t("params.needConnect")
      : error === "PARAMS_EMPTY"
        ? t("params.err.empty")
        : error === "MAVLINK_NO_PARAMS"
          ? t("params.err.mavEmpty")
          : error
            ? error
            : notice === "PARAMS_LOADED_CLI"
              ? t("params.loadedCli")
              : notice === "PARAMS_LOADED_MAV"
                ? t("params.loadedMav")
                : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">{t("params.title")}</h2>
          <p className="mt-1 max-w-2xl text-sm text-fg-muted">{t("params.hint")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            className="w-[140px]"
            value={craft}
            onChange={(e) =>
              setCraft(e.target.value as typeof craft)
            }
          >
            {CRAFT_OPTIONS.map((c) => (
              <option key={c.kind} value={c.kind}>
                {c.label}
              </option>
            ))}
          </Select>
          {craftLabel && <Badge tone="accent">{craftLabel}</Badge>}
          <Button
            variant="secondary"
            disabled={!connected || busy}
            onClick={() => void loadCli()}
          >
            {t("params.loadCli")}
          </Button>
          <Button
            variant="primary"
            disabled={!connected || busy}
            onClick={() => void loadMavlink()}
          >
            {t("params.loadMav")}
          </Button>
        </div>
      </div>

      {banner && (
        <Card className={error ? "border-danger/40" : "border-ok/40"}>
          <p className={`text-sm ${error ? "text-danger" : "text-ok"}`}>{banner}</p>
        </Card>
      )}

      <Card>
        <Input
          placeholder={t("params.search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <CardHint className="mt-2">
          {t("params.stats", {
            count: String(rows.length),
            groups: String(groupList.length),
            protocol,
          })}
        </CardHint>
      </Card>

      <div className="space-y-3">
        {groupList.map((g) => (
          <Card key={g}>
            <CardTitle>{g}</CardTitle>
            <ul className="mt-2 max-h-56 space-y-1 overflow-auto font-mono text-[11px]">
              {rows
                .filter((p) => p.group === g)
                .map((p) => (
                  <li
                    key={`${p.source}-${p.name}`}
                    className="flex justify-between gap-3 border-b border-border/50 py-1"
                  >
                    <span>{p.name}</span>
                    <span className="text-accent">{p.value}</span>
                  </li>
                ))}
            </ul>
          </Card>
        ))}
        {rows.length === 0 && (
          <Card>
            <p className="text-sm text-fg-muted">{t("params.empty")}</p>
          </Card>
        )}
      </div>
    </div>
  );
}
