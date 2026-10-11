import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import {
  boxNameForPermanentId,
  modeRangeToPwm,
  pwmToModeRangeStep,
  type MspModeRange,
  type MspModesSnapshot,
} from "@/lib/mspConfig";
import { readModes, writeModes } from "@/lib/mspPortsModes";
import { useSettingsStore } from "@/stores/settingsStore";

interface Props {
  connected: boolean;
  sessionActive: boolean;
}

export function InavModesCard({ connected, sessionActive }: Props) {
  const { t } = useI18n();
  const flash = useSettingsStore((s) => s.flashNotice);
  const [modes, setModes] = useState<MspModesSnapshot | null>(null);
  const [draft, setDraft] = useState<MspModeRange[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const live = connected && sessionActive;

  const onRefresh = async () => {
    if (!live) {
      flash(t("inav.msp.needConnect"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await readModes();
      if (result.error || !result.modes) {
        setError(result.error ?? "MODES_NO_RESPONSE");
        setModes(null);
        setDraft([]);
        return;
      }
      setModes(result.modes);
      setDraft(result.modes.ranges.map((r) => ({ ...r })));
      flash(t("inav.modes.loaded", { count: String(result.modes.ranges.length) }));
    } finally {
      setBusy(false);
    }
  };

  const updateRange = (index: number, patch: Partial<MspModeRange>) => {
    setDraft((prev) =>
      prev.map((r) => (r.index === index ? { ...r, ...patch } : r)),
    );
  };

  const onWrite = async () => {
    if (!live || !modes) return;
    if (!window.confirm(t("inav.modes.writeConfirm"))) return;
    setBusy(true);
    try {
      const result = await writeModes(draft, modes);
      if (!result.ok) {
        setError(result.error);
        flash(result.error);
        return;
      }
      flash(
        result.backupPath
          ? t("inav.modes.writeOkBackup", { path: result.backupPath })
          : t("inav.modes.writeOk"),
      );
    } finally {
      setBusy(false);
    }
  };

  const errorText =
    error === "MODES_NO_RESPONSE" ? t("inav.modes.noResponse") : error;

  const active = draft.filter(
    (r) => r.permanentId !== 0 || r.startStep !== 0 || r.endStep !== 0,
  );

  return (
    <section
      className="space-y-1.5 rounded border border-aether-border bg-aether-surface-raised/40 p-2"
      data-testid="inav-modes-card"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wide text-aether-fg-dim">
          {t("inav.modes.title")}
        </p>
        <button
          type="button"
          data-testid="inav-modes-refresh"
          disabled={!live || busy}
          onClick={() => void onRefresh()}
          className="flex h-7 items-center gap-1 rounded border border-aether-border px-2 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
        >
          <RefreshCw size={12} className={cn(busy && "animate-spin")} />
          {busy ? t("inav.modes.refreshing") : t("inav.modes.refresh")}
        </button>
      </div>
      <p className="text-[10px] leading-relaxed text-aether-fg-dim">
        {t("inav.modes.hint")}
      </p>
      {errorText && (
        <p className="text-[11px] text-aether-danger">{errorText}</p>
      )}
      {!modes ? (
        <p className="text-[11px] text-aether-fg-dim">{t("inav.modes.empty")}</p>
      ) : (
        <ul className="max-h-48 space-y-1 overflow-auto">
          {(active.length > 0 ? active : draft.slice(0, 8)).map((r) => {
            const name = boxNameForPermanentId(
              r.permanentId,
              modes.boxIds,
              modes.boxNames,
            );
            return (
              <li
                key={r.index}
                className="rounded border border-aether-border/80 px-2 py-1"
              >
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="font-medium text-aether-fg">{name}</span>
                  <span className="text-aether-fg-dim">
                    AUX{r.auxChannelIndex + 1}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-aether-fg-dim">
                  <label className="flex items-center gap-1">
                    {t("inav.modes.start")}
                    <input
                      type="number"
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
                      className="h-6 w-16 rounded border border-aether-border bg-aether-bg px-1 font-mono text-[11px] text-aether-fg"
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    {t("inav.modes.end")}
                    <input
                      type="number"
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
                      className="h-6 w-16 rounded border border-aether-border bg-aether-bg px-1 font-mono text-[11px] text-aether-fg"
                    />
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <button
        type="button"
        disabled={!live || busy || !modes}
        onClick={() => void onWrite()}
        data-testid="inav-modes-write"
        className="rounded border border-aether-border px-2 py-1 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
      >
        {t("inav.modes.write")}
      </button>
    </section>
  );
}
