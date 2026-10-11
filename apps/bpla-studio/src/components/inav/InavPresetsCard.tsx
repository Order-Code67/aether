import { useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import type { MessageKey } from "@/i18n";
import { cn } from "@/lib/cn";
import { FC_PRESETS, presetToCliLines, type FcPresetId } from "@/lib/fcPresets";
import { writeCliLines } from "@/lib/mspTuningIo";
import { useSettingsStore } from "@/stores/settingsStore";

interface Props {
  connected: boolean;
  sessionActive: boolean;
}

export function InavPresetsCard({ connected, sessionActive }: Props) {
  const { t } = useI18n();
  const flash = useSettingsStore((s) => s.flashNotice);
  const [selected, setSelected] = useState<FcPresetId>("mr_freestyle");
  const [busy, setBusy] = useState(false);
  const live = connected && sessionActive;
  const preset = FC_PRESETS.find((p) => p.id === selected)!;

  const onApply = async () => {
    if (!live) {
      flash(t("inav.msp.needConnect"));
      return;
    }
    if (!window.confirm(t("inav.presets.applyConfirm"))) return;
    setBusy(true);
    try {
      const lines = presetToCliLines(preset);
      const result = await writeCliLines(
        lines,
        `preset_${preset.id}`,
        lines.join("\n") + "\n",
      );
      if (!result.ok) {
        flash(result.error);
        return;
      }
      flash(
        result.backupPath
          ? t("inav.presets.applyOkBackup", { path: result.backupPath })
          : t("inav.presets.applyOk"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="space-y-2 rounded border border-aether-border bg-aether-surface-raised/40 p-2"
      data-testid="inav-presets-card"
    >
      <div>
        <p className="text-[11px] uppercase tracking-wide text-aether-fg-dim">
          {t("inav.presets.title")}
        </p>
        <p className="text-[10px] leading-relaxed text-aether-fg-dim">
          {t("inav.presets.hint")}
        </p>
      </div>

      <ul className="space-y-1">
        {FC_PRESETS.map((p) => {
          const active = p.id === selected;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setSelected(p.id)}
                className={cn(
                  "w-full rounded border px-2 py-1.5 text-left",
                  active
                    ? "border-aether-accent bg-aether-accent-muted/50"
                    : "border-aether-border hover:bg-aether-surface-raised",
                )}
              >
                <span className="block text-[11px] font-medium text-aether-fg">
                  {t(p.nameKey as MessageKey)}
                </span>
                <span className="mt-0.5 block text-[10px] text-aether-fg-dim">
                  {t(p.descKey as MessageKey)}
                </span>
                <span className="mt-1 flex flex-wrap gap-1">
                  {p.inspiredBy.map((src) => (
                    <span
                      key={src}
                      className="rounded bg-aether-bg px-1 py-0.5 text-[9px] uppercase tracking-wide text-aether-fg-muted"
                    >
                      {src}
                    </span>
                  ))}
                  <span className="rounded bg-aether-bg px-1 py-0.5 text-[9px] uppercase tracking-wide text-aether-fg-muted">
                    {p.craft}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        disabled={!live || busy}
        data-testid="inav-presets-apply"
        onClick={() => void onApply()}
        className="h-8 w-full rounded border border-aether-accent bg-aether-accent-muted text-[11px] font-medium text-aether-fg disabled:opacity-40"
      >
        {busy ? t("inav.presets.applying") : t("inav.presets.apply")}
      </button>
      <p className="text-[10px] text-aether-fg-dim">{t("inav.presets.eepromHint")}</p>
    </section>
  );
}
