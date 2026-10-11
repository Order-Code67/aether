import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import { FAILSAFE_PROCEDURES, type FailsafeConfig } from "@/lib/mspTuning";
import { readTuningSnapshot, writeFailsafeConfig } from "@/lib/mspTuningIo";
import { useSettingsStore } from "@/stores/settingsStore";

interface Props {
  connected: boolean;
  sessionActive: boolean;
}

export function InavFailsafeCard({ connected, sessionActive }: Props) {
  const { t } = useI18n();
  const flash = useSettingsStore((s) => s.flashNotice);
  const [fs, setFs] = useState<FailsafeConfig | null>(null);
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
      setFs(
        result.snapshot.failsafe ?? {
          procedure: "RTH",
          delayMs: 10,
          throttle: 1000,
        },
      );
      flash(t("inav.failsafe.loaded"));
    } finally {
      setBusy(false);
    }
  };

  const onWrite = async () => {
    if (!live || !fs) return;
    if (!window.confirm(t("inav.failsafe.writeConfirm"))) return;
    setBusy(true);
    try {
      const result = await writeFailsafeConfig(fs);
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
      data-testid="inav-failsafe-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-aether-fg-dim">
            {t("inav.failsafe.title")}
          </p>
          <p className="text-[10px] text-aether-fg-dim">{t("inav.failsafe.hint")}</p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={!live || busy}
            onClick={() => void onLoad()}
            className="flex h-7 items-center gap-1 rounded border border-aether-border px-2 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
          >
            <RefreshCw size={12} className={cn(busy && "animate-spin")} />
            {t("inav.failsafe.load")}
          </button>
          <button
            type="button"
            disabled={!live || busy || !fs}
            onClick={() => void onWrite()}
            className="h-7 rounded border border-aether-accent bg-aether-accent-muted px-2 text-[11px] text-aether-fg disabled:opacity-40"
          >
            {t("inav.failsafe.write")}
          </button>
        </div>
      </div>

      {fs ? (
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
          <label className="space-y-0.5 text-[10px] text-aether-fg-dim">
            <span>{t("inav.failsafe.procedure")}</span>
            <select
              value={fs.procedure}
              onChange={(e) => setFs({ ...fs, procedure: e.target.value })}
              className="h-7 w-full rounded border border-aether-border bg-aether-bg px-1.5 text-[11px] text-aether-fg"
            >
              {FAILSAFE_PROCEDURES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-0.5 text-[10px] text-aether-fg-dim">
            <span>{t("inav.failsafe.delay")}</span>
            <input
              type="number"
              value={fs.delayMs}
              onChange={(e) =>
                setFs({ ...fs, delayMs: Number(e.target.value) || 0 })
              }
              className="h-7 w-full rounded border border-aether-border bg-aether-bg px-1.5 font-mono text-[11px] text-aether-fg"
            />
          </label>
          <label className="space-y-0.5 text-[10px] text-aether-fg-dim">
            <span>{t("inav.failsafe.throttle")}</span>
            <input
              type="number"
              value={fs.throttle}
              onChange={(e) =>
                setFs({ ...fs, throttle: Number(e.target.value) || 0 })
              }
              className="h-7 w-full rounded border border-aether-border bg-aether-bg px-1.5 font-mono text-[11px] text-aether-fg"
            />
          </label>
        </div>
      ) : (
        <p className="text-[11px] text-aether-fg-dim">{t("inav.failsafe.empty")}</p>
      )}
    </section>
  );
}
