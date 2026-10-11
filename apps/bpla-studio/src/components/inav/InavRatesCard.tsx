import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import type { RatesProfile } from "@/lib/mspTuning";
import { readTuningSnapshot, writeRatesProfile } from "@/lib/mspTuningIo";
import { useSettingsStore } from "@/stores/settingsStore";

interface Props {
  connected: boolean;
  sessionActive: boolean;
}

const FIELDS: { key: keyof RatesProfile; label: string }[] = [
  { key: "rollRate", label: "Roll rate" },
  { key: "pitchRate", label: "Pitch rate" },
  { key: "yawRate", label: "Yaw rate" },
  { key: "rcExpo", label: "RC expo" },
  { key: "rcYawExpo", label: "Yaw expo" },
  { key: "thrMid", label: "Thr mid" },
  { key: "thrExpo", label: "Thr expo" },
  { key: "tpaRate", label: "TPA rate" },
  { key: "tpaBreakpoint", label: "TPA breakpoint" },
];

export function InavRatesCard({ connected, sessionActive }: Props) {
  const { t } = useI18n();
  const flash = useSettingsStore((s) => s.flashNotice);
  const [rates, setRates] = useState<RatesProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const live = connected && sessionActive;

  const onLoad = async () => {
    if (!live) {
      flash(t("inav.msp.needConnect"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await readTuningSnapshot({ forceRefresh: true });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (!result.snapshot.rates) {
        setError("RATES_NOT_IN_DIFF");
        setRates(null);
        return;
      }
      setRates(result.snapshot.rates);
      flash(t("inav.rates.loaded"));
    } finally {
      setBusy(false);
    }
  };

  const onWrite = async () => {
    if (!live || !rates) return;
    if (!window.confirm(t("inav.rates.writeConfirm"))) return;
    setBusy(true);
    try {
      const result = await writeRatesProfile(rates);
      if (!result.ok) {
        flash(result.error);
        return;
      }
      flash(
        result.backupPath
          ? t("inav.tuning.writeOkBackup", { path: result.backupPath })
          : t("inav.tuning.writeOk"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="space-y-2 rounded border border-aether-border bg-aether-surface-raised/40 p-2"
      data-testid="inav-rates-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-aether-fg-dim">
            {t("inav.rates.title")}
          </p>
          <p className="text-[10px] text-aether-fg-dim">{t("inav.rates.hint")}</p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={!live || busy}
            onClick={() => void onLoad()}
            className="flex h-7 items-center gap-1 rounded border border-aether-border px-2 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
          >
            <RefreshCw size={12} className={cn(busy && "animate-spin")} />
            {t("inav.rates.load")}
          </button>
          <button
            type="button"
            disabled={!live || busy || !rates}
            onClick={() => void onWrite()}
            className="h-7 rounded border border-aether-accent bg-aether-accent-muted px-2 text-[11px] text-aether-fg disabled:opacity-40"
          >
            {t("inav.rates.write")}
          </button>
        </div>
      </div>
      {error && (
        <p className="text-[11px] text-aether-danger">
          {error === "RATES_NOT_IN_DIFF" ? t("inav.rates.notFound") : error}
        </p>
      )}
      {rates ? (
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {FIELDS.map((f) => (
            <label key={f.key} className="space-y-0.5 text-[10px] text-aether-fg-dim">
              <span>{f.label}</span>
              <input
                type="number"
                value={rates[f.key]}
                onChange={(e) =>
                  setRates({
                    ...rates,
                    [f.key]: Number(e.target.value) || 0,
                  })
                }
                className="h-7 w-full rounded border border-aether-border bg-aether-bg px-1.5 font-mono text-[11px] text-aether-fg outline-none focus:border-aether-accent"
              />
            </label>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-aether-fg-dim">{t("inav.rates.empty")}</p>
      )}
    </section>
  );
}
