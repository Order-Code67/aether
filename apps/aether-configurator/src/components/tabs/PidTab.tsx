import { useEffect } from "react";
import { RefreshCw, Save } from "lucide-react";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/hooks/useI18n";
import { useConnectionStore } from "@/stores/connectionStore";
import { useTuningStore } from "@/stores/tuningStore";
import {
  FILTER_FIELDS,
  RATES_FIELDS,
  type AxisId,
} from "@/core/protocols/msp/tuning";
import type { MessageKey } from "@/i18n";

const AXES: AxisId[] = ["roll", "pitch", "yaw"];
const GAINS = ["p", "i", "d", "ff"] as const;

function messageText(
  t: (key: MessageKey) => string,
  code: string | null,
): string | null {
  if (!code) return null;
  switch (code) {
    case "NOT_CONNECTED":
      return t("pid.needConnect");
    case "ARMED":
      return t("pid.err.armed");
    case "TUNING_NO_RESPONSE":
      return t("pid.err.noResponse");
    case "TUNING_LOADED":
      return t("pid.loaded");
    case "PID_WRITTEN":
      return t("pid.pid.written");
    case "RATES_WRITTEN":
      return t("pid.rates.written");
    case "FILTERS_WRITTEN":
      return t("pid.filter.written");
    default:
      return code;
  }
}

export function PidTab() {
  const { t } = useI18n();
  const connected = useConnectionStore((s) => s.connected);
  const armed = useConnectionStore((s) => s.snapshot.status?.armed ?? false);

  const pid = useTuningStore((s) => s.pid);
  const rates = useTuningStore((s) => s.rates);
  const filters = useTuningStore((s) => s.filters);
  const busy = useTuningStore((s) => s.busy);
  const notice = useTuningStore((s) => s.notice);
  const error = useTuningStore((s) => s.error);
  const dirty = useTuningStore((s) => s.dirty);
  const loadAll = useTuningStore((s) => s.loadAll);
  const setPidGain = useTuningStore((s) => s.setPidGain);
  const setRate = useTuningStore((s) => s.setRate);
  const setFilter = useTuningStore((s) => s.setFilter);
  const writePid = useTuningStore((s) => s.writePid);
  const writeRates = useTuningStore((s) => s.writeRates);
  const writeFilters = useTuningStore((s) => s.writeFilters);

  useEffect(() => {
    if (connected && !pid && !busy) {
      void loadAll();
    }
  }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps

  const banner = messageText(t, error) ?? messageText(t, notice);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">{t("pid.title")}</h2>
          <p className="mt-1 max-w-2xl text-sm text-fg-muted">{t("pid.hint")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {armed && <Badge tone="danger">{t("dashboard.armed")}</Badge>}
          <Button
            variant="secondary"
            disabled={!connected || busy}
            onClick={() => void loadAll()}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
            {t("pid.load")}
          </Button>
        </div>
      </div>

      {!connected && (
        <Card>
          <p className="text-sm text-fg-muted">{t("pid.needConnect")}</p>
        </Card>
      )}

      {banner && (
        <Card className={error ? "border-danger/40" : "border-ok/40"}>
          <p className={`text-sm ${error ? "text-danger" : "text-ok"}`}>
            {banner}
          </p>
        </Card>
      )}

      <p className="text-[11px] text-fg-muted">{t("pid.eepromNote")}</p>

      {/* PID */}
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>{t("pid.pid.title")}</CardTitle>
            <CardHint>{t("pid.pid.hint")}</CardHint>
          </div>
          <div className="flex items-center gap-2">
            {dirty.pid && <Badge tone="warn">{t("pid.dirty")}</Badge>}
            <Button
              variant="primary"
              disabled={!connected || busy || !pid || armed}
              onClick={() => {
                if (!window.confirm(t("pid.pid.confirm"))) return;
                void writePid();
              }}
            >
              <Save className="h-3.5 w-3.5" />
              {t("pid.pid.write")}
            </Button>
          </div>
        </div>

        {pid ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-xs">
              <thead>
                <tr className="text-fg-muted">
                  <th className="py-1 pr-2 font-medium">Axis</th>
                  {GAINS.map((g) => (
                    <th key={g} className="px-1 py-1 font-medium uppercase">
                      {g}
                      {g === "ff" && (
                        <span className="ml-1 font-normal normal-case text-[10px]">
                          ({t("pid.pid.ffNote")})
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {AXES.map((axis) => (
                  <tr key={axis}>
                    <td className="py-1 pr-2 font-medium capitalize">{axis}</td>
                    {GAINS.map((g) => (
                      <td key={g} className="px-1 py-1">
                        <Input
                          type="number"
                          className="w-[72px]"
                          value={pid[axis][g]}
                          disabled={g === "ff"}
                          min={0}
                          max={255}
                          onChange={(e) =>
                            setPidGain(axis, g, Number(e.target.value))
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-fg-muted">{t("pid.empty")}</p>
        )}
      </Card>

      {/* Rates */}
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>{t("pid.rates.title")}</CardTitle>
            <CardHint>{t("pid.rates.hint")}</CardHint>
          </div>
          <div className="flex items-center gap-2">
            {dirty.rates && <Badge tone="warn">{t("pid.dirty")}</Badge>}
            <Button
              variant="primary"
              disabled={!connected || busy || !rates || armed}
              onClick={() => {
                if (!window.confirm(t("pid.rates.confirm"))) return;
                void writeRates();
              }}
            >
              <Save className="h-3.5 w-3.5" />
              {t("pid.rates.write")}
            </Button>
          </div>
        </div>

        {rates ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {RATES_FIELDS.map(({ key, labelKey }) => (
              <label key={key} className="block text-xs">
                <span className="text-fg-muted">
                  {t(labelKey as MessageKey)}
                </span>
                <Input
                  type="number"
                  className="mt-1"
                  value={rates[key]}
                  min={0}
                  max={key === "tpaBreakpoint" ? 2000 : 255}
                  onChange={(e) => setRate(key, Number(e.target.value))}
                />
              </label>
            ))}
          </div>
        ) : (
          <p className="text-xs text-fg-muted">{t("pid.empty")}</p>
        )}
      </Card>

      {/* Filters */}
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>{t("pid.filter.title")}</CardTitle>
            <CardHint>{t("pid.filter.hint")}</CardHint>
          </div>
          <div className="flex items-center gap-2">
            {dirty.filters && <Badge tone="warn">{t("pid.dirty")}</Badge>}
            <Button
              variant="primary"
              disabled={!connected || busy || !filters || armed}
              onClick={() => {
                if (!window.confirm(t("pid.filter.confirm"))) return;
                void writeFilters();
              }}
            >
              <Save className="h-3.5 w-3.5" />
              {t("pid.filter.write")}
            </Button>
          </div>
        </div>

        {filters ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {FILTER_FIELDS.map(({ key, labelKey }) => (
              <label key={key} className="block text-xs">
                <span className="text-fg-muted">
                  {t(labelKey as MessageKey)}
                </span>
                <Input
                  type="number"
                  className="mt-1"
                  value={filters[key]}
                  min={0}
                  max={1000}
                  onChange={(e) => setFilter(key, Number(e.target.value))}
                />
              </label>
            ))}
          </div>
        ) : (
          <p className="text-xs text-fg-muted">{t("pid.empty")}</p>
        )}
      </Card>
    </div>
  );
}
