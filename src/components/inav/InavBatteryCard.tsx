import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import type { BatteryConfig } from "@/lib/mspTuning";
import { readTuningSnapshot, writeBatteryConfig } from "@/lib/mspTuningIo";
import { useInavStore } from "@/stores/inavStore";
import { useSettingsStore } from "@/stores/settingsStore";

interface Props {
  connected: boolean;
  sessionActive: boolean;
}

export function InavBatteryCard({ connected, sessionActive }: Props) {
  const { t } = useI18n();
  const flash = useSettingsStore((s) => s.flashNotice);
  const analog = useInavStore((s) => s.mspSnapshot?.analog);
  const [bat, setBat] = useState<BatteryConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const live = connected && sessionActive;

  const onLoad = async () => {
    if (!live) {
      flash(t("inav.msp.needConnect"));
      return;
    }
    setBusy(true);
    try {
      const result = await readTuningSnapshot({ forceRefresh: true });
      if (!result.ok) {
        flash(result.error);
        return;
      }
      if (!result.snapshot.battery) {
        setBat({
          vbatMinCell: 330,
          vbatMaxCell: 430,
          vbatWarningCell: 350,
          capacity: 0,
          voltageScale: 1100,
          currentScale: 400,
        });
        flash(t("inav.battery.defaults"));
        return;
      }
      setBat(result.snapshot.battery);
      flash(t("inav.battery.loaded"));
    } finally {
      setBusy(false);
    }
  };

  const onWrite = async () => {
    if (!live || !bat) return;
    if (!window.confirm(t("inav.battery.writeConfirm"))) return;
    setBusy(true);
    try {
      const result = await writeBatteryConfig(bat);
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

  const field = (
    key: keyof BatteryConfig,
    label: string,
  ) =>
    bat ? (
      <label className="space-y-0.5 text-[10px] text-aether-fg-dim">
        <span>{label}</span>
        <input
          type="number"
          value={bat[key]}
          onChange={(e) =>
            setBat({ ...bat, [key]: Number(e.target.value) || 0 })
          }
          className="h-7 w-full rounded border border-aether-border bg-aether-bg px-1.5 font-mono text-[11px] text-aether-fg outline-none focus:border-aether-accent"
        />
      </label>
    ) : null;

  return (
    <section
      className="space-y-2 rounded border border-aether-border bg-aether-surface-raised/40 p-2"
      data-testid="inav-battery-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-aether-fg-dim">
            {t("inav.battery.title")}
          </p>
          <p className="text-[10px] text-aether-fg-dim">{t("inav.battery.hint")}</p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={!live || busy}
            onClick={() => void onLoad()}
            className="flex h-7 items-center gap-1 rounded border border-aether-border px-2 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
          >
            <RefreshCw size={12} className={cn(busy && "animate-spin")} />
            {t("inav.battery.load")}
          </button>
          <button
            type="button"
            disabled={!live || busy || !bat}
            onClick={() => void onWrite()}
            className="h-7 rounded border border-aether-accent bg-aether-accent-muted px-2 text-[11px] text-aether-fg disabled:opacity-40"
          >
            {t("inav.battery.write")}
          </button>
        </div>
      </div>

      {analog && (
        <p className="font-mono text-[11px] text-aether-fg">
          {t("inav.battery.live", {
            v: analog.voltage.toFixed(1),
            mah: String(analog.mAhDrawn),
            a:
              analog.amperage != null
                ? analog.amperage.toFixed(1)
                : "—",
          })}
        </p>
      )}

      {bat ? (
        <div className="grid grid-cols-2 gap-1.5">
          {field("capacity", t("inav.battery.capacity"))}
          {field("vbatMinCell", t("inav.battery.vMin"))}
          {field("vbatWarningCell", t("inav.battery.vWarn"))}
          {field("vbatMaxCell", t("inav.battery.vMax"))}
          {field("voltageScale", t("inav.battery.vScale"))}
          {field("currentScale", t("inav.battery.iScale"))}
        </div>
      ) : (
        <p className="text-[11px] text-aether-fg-dim">{t("inav.battery.empty")}</p>
      )}
    </section>
  );
}
