import { HardDrive, RefreshCw } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import { mspGpsFixLabel } from "@/lib/mspMinimal";
import { eepromWriteMsp } from "@/lib/mspPortsModes";
import { useInavStore } from "@/stores/inavStore";
import { useSerialStore } from "@/stores/serialStore";
import { useSettingsStore } from "@/stores/settingsStore";

/** Live FC strip shown while connected through Aether. */
export function InavSessionHud() {
  const { t } = useI18n();
  const flash = useSettingsStore((s) => s.flashNotice);
  const connected = useSerialStore((s) => s.connected);
  const selectedPath = useSerialStore((s) => s.selectedPath);
  const baudRate = useSerialStore((s) => s.baudRate);
  const sessionActive = useInavStore((s) => s.sessionActive);
  const snapshot = useInavStore((s) => s.mspSnapshot);
  const polling = useInavStore((s) => s.mspPolling);
  const refreshMspStatus = useInavStore((s) => s.refreshMspStatus);
  const live = connected && sessionActive;

  const onEeprom = async () => {
    if (!live) {
      flash(t("inav.needConnect"));
      return;
    }
    if (!window.confirm(t("inav.eeprom.confirm"))) return;
    const result = await eepromWriteMsp();
    if (!result.ok) {
      flash(result.error);
      return;
    }
    flash(t("inav.eeprom.saved"));
  };

  if (!live) {
    return (
      <div
        className="flex flex-wrap items-center gap-2 border-b border-aether-border bg-aether-surface/60 px-4 py-2 text-[11px] text-aether-fg-dim"
        data-testid="inav-session-hud"
      >
        <span className="h-2 w-2 rounded-full bg-aether-fg-dim" />
        {t("inav.hudDisconnected")}
      </div>
    );
  }

  const name = snapshot?.name?.trim() || "—";
  const variant = snapshot?.fcVariant ?? "—";
  const ver = snapshot?.fcVersion
    ? `${snapshot.fcVersion.major}.${snapshot.fcVersion.minor}.${snapshot.fcVersion.patch}`
    : "—";
  const volts = snapshot?.analog ? snapshot.analog.voltage.toFixed(1) : "—";
  const gps = snapshot?.gps
    ? `${mspGpsFixLabel(snapshot.gps.fix)} · ${snapshot.gps.numSat}`
    : "—";
  const armed = snapshot?.status?.armed;

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-aether-border bg-aether-surface/80 px-4 py-2 text-[11px]"
      data-testid="inav-session-hud"
    >
      <span className="flex items-center gap-1.5 font-medium text-emerald-400">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
        {t("inav.hudConnected", { port: selectedPath, baud: String(baudRate) })}
      </span>
      <span className="font-mono text-aether-fg">
        {name} · {variant} {ver}
      </span>
      <span className="font-mono text-aether-fg">
        {t("inav.msp.voltageValue", { v: volts })}
      </span>
      <span className="font-mono text-aether-fg">
        GPS {gps}
      </span>
      <span
        className={cn(
          "font-mono",
          armed ? "text-amber-400" : "text-aether-fg-dim",
        )}
      >
        {armed ? t("inav.msp.armedYes") : t("inav.msp.armedNo")}
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          disabled={polling}
          onClick={() => void refreshMspStatus()}
          className="flex h-7 items-center gap-1 rounded border border-aether-border px-2 text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
        >
          <RefreshCw size={12} className={cn(polling && "animate-spin")} />
          {t("inav.msp.refresh")}
        </button>
        <button
          type="button"
          onClick={() => void onEeprom()}
          className="flex h-7 items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-2 text-amber-200 hover:bg-amber-500/20"
        >
          <HardDrive size={12} />
          {t("inav.eeprom.save")}
        </button>
      </div>
    </div>
  );
}
