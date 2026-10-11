import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import {
  MIXER_TYPES,
  PLATFORM_TYPES,
  type FeatureFlag,
  type MixerInfo,
} from "@/lib/mspTuning";
import { readTuningSnapshot, writeMixerConfig, writeCliLines } from "@/lib/mspTuningIo";
import { useSettingsStore } from "@/stores/settingsStore";

interface Props {
  connected: boolean;
  sessionActive: boolean;
}

export function InavMixerCard({ connected, sessionActive }: Props) {
  const { t } = useI18n();
  const flash = useSettingsStore((s) => s.flashNotice);
  const [mixer, setMixer] = useState<MixerInfo | null>(null);
  const [features, setFeatures] = useState<FeatureFlag[]>([]);
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
      setMixer(
        result.snapshot.mixer ?? {
          mixer: "QUADX",
          platformType: "MULTIROTOR",
        },
      );
      setFeatures(result.snapshot.features);
      flash(t("inav.mixer.loaded"));
    } finally {
      setBusy(false);
    }
  };

  const onWrite = async () => {
    if (!live || !mixer) return;
    if (!window.confirm(t("inav.mixer.writeConfirm"))) return;
    setBusy(true);
    try {
      const mixResult = await writeMixerConfig(mixer);
      if (!mixResult.ok) {
        flash(mixResult.error);
        return;
      }
      const featLines = features.map((f) =>
        f.enabled ? `feature ${f.id}` : `feature -${f.id}`,
      );
      if (featLines.length > 0) {
        await writeCliLines(featLines, "features_prewrite", featLines.join("\n") + "\n");
      }
      flash(
        mixResult.backupPath
          ? t("inav.tuning.writeOkBackup", { path: mixResult.backupPath })
          : t("inav.tuning.writeOk"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="space-y-2 rounded border border-aether-border bg-aether-surface-raised/40 p-2"
      data-testid="inav-mixer-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-aether-fg-dim">
            {t("inav.mixer.title")}
          </p>
          <p className="text-[10px] text-aether-fg-dim">{t("inav.mixer.hint")}</p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={!live || busy}
            onClick={() => void onLoad()}
            className="flex h-7 items-center gap-1 rounded border border-aether-border px-2 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
          >
            <RefreshCw size={12} className={cn(busy && "animate-spin")} />
            {t("inav.mixer.load")}
          </button>
          <button
            type="button"
            disabled={!live || busy || !mixer}
            onClick={() => void onWrite()}
            className="h-7 rounded border border-aether-accent bg-aether-accent-muted px-2 text-[11px] text-aether-fg disabled:opacity-40"
          >
            {t("inav.mixer.write")}
          </button>
        </div>
      </div>

      {mixer ? (
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          <label className="space-y-0.5 text-[10px] text-aether-fg-dim">
            <span>{t("inav.mixer.mixer")}</span>
            <select
              value={mixer.mixer}
              onChange={(e) => setMixer({ ...mixer, mixer: e.target.value })}
              className="h-7 w-full rounded border border-aether-border bg-aether-bg px-1.5 text-[11px] text-aether-fg"
            >
              {[mixer.mixer, ...MIXER_TYPES]
                .filter((v, i, a) => a.indexOf(v) === i)
                .map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
            </select>
          </label>
          <label className="space-y-0.5 text-[10px] text-aether-fg-dim">
            <span>{t("inav.mixer.platform")}</span>
            <select
              value={mixer.platformType ?? "MULTIROTOR"}
              onChange={(e) =>
                setMixer({ ...mixer, platformType: e.target.value })
              }
              className="h-7 w-full rounded border border-aether-border bg-aether-bg px-1.5 text-[11px] text-aether-fg"
            >
              {PLATFORM_TYPES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <p className="text-[11px] text-aether-fg-dim">{t("inav.mixer.empty")}</p>
      )}

      {features.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {features.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() =>
                setFeatures((prev) =>
                  prev.map((x) =>
                    x.id === f.id ? { ...x, enabled: !x.enabled } : x,
                  ),
                )
              }
              className={cn(
                "rounded border px-1.5 py-0.5 font-mono text-[10px]",
                f.enabled
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-aether-border text-aether-fg-dim",
              )}
            >
              {f.id}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
