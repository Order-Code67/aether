import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import { emptyPid, type AxisId, type PidProfile } from "@/lib/mspTuning";
import { readTuningSnapshot, writePidProfile } from "@/lib/mspTuningIo";
import { useSettingsStore } from "@/stores/settingsStore";

interface Props {
  connected: boolean;
  sessionActive: boolean;
}

const AXES: AxisId[] = ["roll", "pitch", "yaw"];
const GAINS = ["p", "i", "d", "ff"] as const;

export function InavPidCard({ connected, sessionActive }: Props) {
  const { t } = useI18n();
  const flash = useSettingsStore((s) => s.flashNotice);
  const [pid, setPid] = useState<PidProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const live = connected && sessionActive;

  const onLoad = async (force = false) => {
    if (!live) {
      flash(t("inav.msp.needConnect"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await readTuningSnapshot({ forceRefresh: force });
      if (!result.ok) {
        setError(result.error);
        setPid(null);
        return;
      }
      if (!result.snapshot.pid) {
        setPid(emptyPid("mc"));
        flash(t("inav.pid.emptyDefaults"));
        return;
      }
      setPid(result.snapshot.pid);
      flash(t("inav.pid.loaded", { family: result.snapshot.pid.family }));
    } finally {
      setBusy(false);
    }
  };

  const onWrite = async () => {
    if (!live || !pid) return;
    if (!window.confirm(t("inav.pid.writeConfirm"))) return;
    setBusy(true);
    try {
      const result = await writePidProfile(pid);
      if (!result.ok) {
        setError(result.error);
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

  const setGain = (axis: AxisId, gain: (typeof GAINS)[number], value: number) => {
    setPid((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [axis]: { ...prev[axis], [gain]: value },
      };
    });
  };

  return (
    <section
      className="space-y-2 rounded border border-aether-border bg-aether-surface-raised/40 p-2"
      data-testid="inav-pid-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-aether-fg-dim">
            {t("inav.pid.title")}
          </p>
          <p className="text-[10px] text-aether-fg-dim">{t("inav.pid.hint")}</p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={!live || busy}
            onClick={() => void onLoad(true)}
            className="flex h-7 items-center gap-1 rounded border border-aether-border px-2 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
          >
            <RefreshCw size={12} className={cn(busy && "animate-spin")} />
            {t("inav.pid.load")}
          </button>
          <button
            type="button"
            disabled={!live || busy || !pid}
            onClick={() => void onWrite()}
            className="h-7 rounded border border-aether-accent bg-aether-accent-muted px-2 text-[11px] text-aether-fg disabled:opacity-40"
          >
            {t("inav.pid.write")}
          </button>
        </div>
      </div>

      {error && <p className="text-[11px] text-aether-danger">{error}</p>}

      {pid && (
        <>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-aether-fg-dim">{t("inav.pid.family")}</span>
            <select
              value={pid.family}
              onChange={(e) =>
                setPid((p) =>
                  p
                    ? { ...p, family: e.target.value as "mc" | "fw" }
                    : p,
                )
              }
              className="h-7 rounded border border-aether-border bg-aether-bg px-1.5 text-[11px] text-aether-fg"
            >
              <option value="mc">mc_* (multirotor)</option>
              <option value="fw">fw_* (airplane / wing)</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[280px] text-left text-[11px]">
              <thead>
                <tr className="text-aether-fg-dim">
                  <th className="py-1 pr-2 font-medium">Axis</th>
                  {GAINS.map((g) => (
                    <th key={g} className="px-1 py-1 font-medium uppercase">
                      {g}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {AXES.map((axis) => (
                  <tr key={axis}>
                    <td className="py-1 pr-2 font-mono capitalize text-aether-fg">
                      {axis}
                    </td>
                    {GAINS.map((g) => (
                      <td key={g} className="px-1 py-0.5">
                        <input
                          type="number"
                          value={pid[axis][g]}
                          onChange={(e) =>
                            setGain(axis, g, Number(e.target.value) || 0)
                          }
                          className="h-7 w-14 rounded border border-aether-border bg-aether-bg px-1 font-mono text-[11px] text-aether-fg outline-none focus:border-aether-accent"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!pid && !error && (
        <p className="text-[11px] text-aether-fg-dim">{t("inav.pid.empty")}</p>
      )}
    </section>
  );
}
