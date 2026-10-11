import { useEffect } from "react";
import { RefreshCw, Save, Trash2 } from "lucide-react";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { ModeRangeBar } from "@/components/tabs/modes/ModeRangeBar";
import { useI18n } from "@/hooks/useI18n";
import { useConnectionStore } from "@/stores/connectionStore";
import { useUiStore } from "@/stores/uiStore";
import {
  useModesStore,
  visibleModeRanges,
} from "@/stores/modesStore";
import {
  boxNameForPermanentId,
  modeRangeToPwm,
  pwmToModeRangeStep,
} from "@/core/protocols/msp/modes";
import type { MessageKey } from "@/i18n";

function messageText(
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
  code: string | null,
  vars?: Record<string, string | number>,
): string | null {
  if (!code) return null;
  switch (code) {
    case "NOT_CONNECTED":
      return t("modes.needConnect");
    case "ARMED":
      return t("modes.err.armed");
    case "MODES_NO_RESPONSE":
      return t("modes.err.noResponse");
    case "MODES_LOADED":
      return t("modes.loaded", vars);
    case "MODES_WRITTEN":
      return t("modes.written");
    default:
      return code;
  }
}

export function ModesTab() {
  const { t } = useI18n();
  const connected = useConnectionStore((s) => s.connected);
  const armed = useConnectionStore((s) => s.snapshot.status?.armed ?? false);
  const activeTab = useUiStore((s) => s.activeTab);

  const snapshot = useModesStore((s) => s.snapshot);
  const draft = useModesStore((s) => s.draft);
  const rcChannels = useModesStore((s) => s.rcChannels);
  const liveRc = useModesStore((s) => s.liveRc);
  const busy = useModesStore((s) => s.busy);
  const dirty = useModesStore((s) => s.dirty);
  const showAll = useModesStore((s) => s.showAll);
  const notice = useModesStore((s) => s.notice);
  const error = useModesStore((s) => s.error);
  const load = useModesStore((s) => s.load);
  const write = useModesStore((s) => s.write);
  const updateRange = useModesStore((s) => s.updateRange);
  const clearRange = useModesStore((s) => s.clearRange);
  const setShowAll = useModesStore((s) => s.setShowAll);
  const startLiveRc = useModesStore((s) => s.startLiveRc);
  const stopLiveRc = useModesStore((s) => s.stopLiveRc);

  useEffect(() => {
    if (activeTab !== "modes") {
      stopLiveRc();
      return;
    }
    if (connected) {
      void load();
      startLiveRc();
    } else {
      stopLiveRc();
    }
    return () => stopLiveRc();
  }, [activeTab, connected]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = visibleModeRanges(draft, showAll);
  const activeCount = draft.filter(
    (r) => r.permanentId !== 0 || r.startStep !== 0 || r.endStep !== 0,
  ).length;

  const banner = messageText(
    t,
    error,
  ) ?? messageText(t, notice, { count: activeCount });

  const boxOptions =
    snapshot?.boxIds.map((id, i) => ({
      id,
      name: snapshot.boxNames[i] ?? `ID ${id}`,
    })) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">
            {t("modes.title")}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-fg-muted">{t("modes.hint")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {armed && <Badge tone="danger">{t("dashboard.armed")}</Badge>}
          <Badge tone={liveRc ? "ok" : "neutral"}>
            {liveRc ? t("modes.liveRcOn") : t("modes.liveRcOff")}
          </Badge>
          {dirty && <Badge tone="warn">{t("modes.dirty")}</Badge>}
          <label className="flex items-center gap-1.5 text-xs text-fg-muted">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            />
            {t("modes.showAll")}
          </label>
          <Button
            variant="secondary"
            disabled={!connected || busy}
            onClick={() => void load()}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
            {t("modes.load")}
          </Button>
          <Button
            variant="primary"
            disabled={!connected || busy || !snapshot || armed}
            onClick={() => {
              if (!window.confirm(t("modes.confirm"))) return;
              void write();
            }}
          >
            <Save className="h-3.5 w-3.5" />
            {t("modes.write")}
          </Button>
        </div>
      </div>

      {!connected && (
        <Card>
          <p className="text-sm text-fg-muted">{t("modes.needConnect")}</p>
        </Card>
      )}

      {banner && (
        <Card className={error ? "border-danger/40" : "border-ok/40"}>
          <p className={`text-sm ${error ? "text-danger" : "text-ok"}`}>
            {banner}
          </p>
        </Card>
      )}

      <p className="text-[11px] text-fg-muted">{t("modes.eepromNote")}</p>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <CardTitle>{t("modes.listTitle")}</CardTitle>
            <CardHint>
              {t("modes.listHint", { count: String(activeCount) })}
            </CardHint>
          </div>
        </div>

        {!snapshot ? (
          <p className="text-xs text-fg-muted">{t("modes.empty")}</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-fg-muted">{t("modes.empty")}</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => {
              const auxPwm = rcChannels[4 + r.auxChannelIndex];
              return (
                <li
                  key={r.index}
                  className="rounded-md border border-border bg-surface-2/40 p-3"
                >
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="min-w-[140px] flex-1 text-xs">
                      <span className="text-fg-muted">{t("modes.mode")}</span>
                      <Select
                        className="mt-1"
                        value={r.permanentId}
                        disabled={busy}
                        onChange={(e) =>
                          updateRange(r.index, {
                            permanentId: Number(e.target.value),
                          })
                        }
                      >
                        <option value={0}>—</option>
                        {boxOptions.map((b) => (
                          <option key={`${r.index}-${b.id}`} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </Select>
                    </label>

                    <label className="w-[100px] text-xs">
                      <span className="text-fg-muted">{t("modes.aux")}</span>
                      <Select
                        className="mt-1"
                        value={r.auxChannelIndex}
                        disabled={busy}
                        onChange={(e) =>
                          updateRange(r.index, {
                            auxChannelIndex: Number(e.target.value),
                          })
                        }
                      >
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i} value={i}>
                            AUX{i + 1}
                          </option>
                        ))}
                      </Select>
                    </label>

                    <label className="w-[90px] text-xs">
                      <span className="text-fg-muted">{t("modes.start")}</span>
                      <Input
                        type="number"
                        className="mt-1 font-mono"
                        min={900}
                        max={2100}
                        step={25}
                        value={modeRangeToPwm(r.startStep)}
                        disabled={busy}
                        onChange={(e) =>
                          updateRange(r.index, {
                            startStep: pwmToModeRangeStep(Number(e.target.value)),
                          })
                        }
                      />
                    </label>

                    <label className="w-[90px] text-xs">
                      <span className="text-fg-muted">{t("modes.end")}</span>
                      <Input
                        type="number"
                        className="mt-1 font-mono"
                        min={900}
                        max={2100}
                        step={25}
                        value={modeRangeToPwm(r.endStep)}
                        disabled={busy}
                        onChange={(e) =>
                          updateRange(r.index, {
                            endStep: pwmToModeRangeStep(Number(e.target.value)),
                          })
                        }
                      />
                    </label>

                    <Button
                      variant="ghost"
                      disabled={busy}
                      title={t("modes.clear")}
                      onClick={() => clearRange(r.index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="mt-2">
                    <ModeRangeBar
                      startStep={r.startStep}
                      endStep={r.endStep}
                      livePwm={auxPwm}
                    />
                    <div className="mt-1 flex justify-between font-mono text-[10px] text-fg-muted">
                      <span>
                        #{r.index} ·{" "}
                        {boxNameForPermanentId(
                          r.permanentId,
                          snapshot.boxIds,
                          snapshot.boxNames,
                        )}
                      </span>
                      <span>
                        {auxPwm != null
                          ? `${t("modes.live")}: ${auxPwm}`
                          : "900 — 2100"}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
