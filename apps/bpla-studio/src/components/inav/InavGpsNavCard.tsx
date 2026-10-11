import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import { filterCliParams, type FcCliParam } from "@/lib/fcCliParams";
import { mspGpsFixLabel } from "@/lib/mspMinimal";
import { writeCliLines, readTuningSnapshot } from "@/lib/mspTuningIo";
import { useInavStore } from "@/stores/inavStore";
import { useSettingsStore } from "@/stores/settingsStore";

interface Props {
  connected: boolean;
  sessionActive: boolean;
}

export function InavGpsNavCard({ connected, sessionActive }: Props) {
  const { t } = useI18n();
  const flash = useSettingsStore((s) => s.flashNotice);
  const gps = useInavStore((s) => s.mspSnapshot?.gps);
  const refreshMsp = useInavStore((s) => s.refreshMspStatus);
  const [params, setParams] = useState<FcCliParam[]>([]);
  const [busy, setBusy] = useState(false);
  const live = connected && sessionActive;

  const navParams = useMemo(
    () => filterCliParams(params, "", "gps_nav").slice(0, 40),
    [params],
  );

  const onLoad = async () => {
    if (!live) {
      flash(t("inav.msp.needConnect"));
      return;
    }
    setBusy(true);
    try {
      void refreshMsp();
      const result = await readTuningSnapshot({ forceRefresh: true });
      if (!result.ok) {
        flash(result.error);
        return;
      }
      setParams(result.snapshot.params);
      const count = filterCliParams(result.snapshot.params, "", "gps_nav").length;
      flash(t("inav.gps.loaded", { count: String(count) }));
    } finally {
      setBusy(false);
    }
  };

  const onChange = (name: string, value: string) => {
    setParams((prev) =>
      prev.map((p) =>
        p.kind === "set" && p.name === name ? { ...p, value } : p,
      ),
    );
  };

  const onWrite = async () => {
    if (!live || navParams.length === 0) return;
    if (!window.confirm(t("inav.gps.writeConfirm"))) return;
    setBusy(true);
    try {
      const lines = navParams.map((p) => `set ${p.name} = ${p.value}`);
      const result = await writeCliLines(lines, "gps_nav_prewrite", lines.join("\n") + "\n");
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
      data-testid="inav-gps-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-aether-fg-dim">
            {t("inav.gps.title")}
          </p>
          <p className="text-[10px] text-aether-fg-dim">{t("inav.gps.hint")}</p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={!live || busy}
            onClick={() => void onLoad()}
            className="flex h-7 items-center gap-1 rounded border border-aether-border px-2 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
          >
            <RefreshCw size={12} className={cn(busy && "animate-spin")} />
            {t("inav.gps.load")}
          </button>
          <button
            type="button"
            disabled={!live || busy || navParams.length === 0}
            onClick={() => void onWrite()}
            className="h-7 rounded border border-aether-accent bg-aether-accent-muted px-2 text-[11px] text-aether-fg disabled:opacity-40"
          >
            {t("inav.gps.write")}
          </button>
        </div>
      </div>

      {gps ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
          <dt className="text-aether-fg-dim">{t("inav.msp.gps")}</dt>
          <dd className="font-mono text-aether-fg">
            {t("inav.msp.gpsValue", {
              fix: mspGpsFixLabel(gps.fix),
              sats: String(gps.numSat),
            })}
          </dd>
          <dt className="text-aether-fg-dim">{t("inav.gps.alt")}</dt>
          <dd className="font-mono text-aether-fg">{gps.alt} m</dd>
          <dt className="text-aether-fg-dim">{t("inav.gps.speed")}</dt>
          <dd className="font-mono text-aether-fg">
            {gps.speed.toFixed(1)} m/s
          </dd>
          {gps.fix >= 2 && (
            <>
              <dt className="text-aether-fg-dim">{t("inav.msp.latLon")}</dt>
              <dd className="font-mono text-aether-fg">
                {gps.lat.toFixed(6)}, {gps.lon.toFixed(6)}
              </dd>
            </>
          )}
        </dl>
      ) : (
        <p className="text-[11px] text-aether-fg-dim">{t("inav.gps.noLive")}</p>
      )}

      {navParams.length > 0 ? (
        <ul className="max-h-56 space-y-1 overflow-auto">
          {navParams.map((p) => (
            <li
              key={p.name}
              className="flex items-center gap-2 rounded border border-aether-border/60 px-1.5 py-1"
            >
              <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-aether-fg">
                {p.name}
              </span>
              <input
                value={p.value}
                onChange={(e) => onChange(p.name, e.target.value)}
                className="h-6 w-24 rounded border border-aether-border bg-aether-bg px-1 font-mono text-[10px] text-aether-fg"
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-aether-fg-dim">{t("inav.gps.emptyParams")}</p>
      )}
    </section>
  );
}
