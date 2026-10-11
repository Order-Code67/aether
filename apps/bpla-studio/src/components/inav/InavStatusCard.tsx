import { RefreshCw } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import type { MessageKey } from "@/i18n";
import { cn } from "@/lib/cn";
import {
  mspGpsFixLabel,
  sensorsPresentLabels,
  type MspStatusSnapshot,
} from "@/lib/mspMinimal";
import { useInavStore } from "@/stores/inavStore";

const SENSOR_KEYS: Record<string, MessageKey> = {
  acc: "inav.msp.sensor.acc",
  baro: "inav.msp.sensor.baro",
  mag: "inav.msp.sensor.mag",
  gps: "inav.msp.sensor.gps",
  sonar: "inav.msp.sensor.sonar",
  gyro: "inav.msp.sensor.gyro",
  opticalflow: "inav.msp.sensor.opticalflow",
};

function formatVersion(snap: MspStatusSnapshot): string {
  const v = snap.fcVersion;
  if (!v) return "—";
  return `${v.major}.${v.minor}.${v.patch}`;
}

function formatApi(snap: MspStatusSnapshot): string {
  const a = snap.apiVersion;
  if (!a) return "—";
  return `${a.apiMajor}.${a.apiMinor} (p${a.protocolVersion})`;
}

interface Props {
  connected: boolean;
  sessionActive: boolean;
}

export function InavStatusCard({ connected, sessionActive }: Props) {
  const { t } = useI18n();
  const snapshot = useInavStore((s) => s.mspSnapshot);
  const polling = useInavStore((s) => s.mspPolling);
  const mspError = useInavStore((s) => s.mspError);
  const refreshMspStatus = useInavStore((s) => s.refreshMspStatus);

  const live = connected && sessionActive;
  const sensors = snapshot?.status
    ? sensorsPresentLabels(snapshot.status.sensors)
    : [];

  const errorText = (() => {
    if (!mspError) return null;
    if (mspError === "MSP_NEED_CONNECT") return t("inav.msp.needConnect");
    if (mspError === "MSP_NO_RESPONSE") return t("inav.msp.noResponse");
    return mspError;
  })();

  return (
    <section
      className="space-y-1.5 rounded border border-aether-border bg-aether-surface-raised/40 p-2"
      data-testid="inav-status-card"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wide text-aether-fg-dim">
          {t("inav.msp.title")}
        </p>
        <button
          type="button"
          data-testid="inav-msp-refresh"
          disabled={!live || polling}
          onClick={() => void refreshMspStatus()}
          className="flex h-7 items-center gap-1 rounded border border-aether-border px-2 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
        >
          <RefreshCw size={12} className={cn(polling && "animate-spin")} />
          {polling ? t("inav.msp.refreshing") : t("inav.msp.refresh")}
        </button>
      </div>

      <p className="text-[10px] leading-relaxed text-aether-fg-dim">
        {t("inav.msp.hint")}
      </p>

      {!live && (
        <p className="text-[11px] text-aether-fg-dim">{t("inav.msp.needConnect")}</p>
      )}

      {errorText && (
        <p className="text-[11px] text-aether-danger" data-testid="inav-msp-error">
          {errorText}
        </p>
      )}

      {snapshot && snapshot.fcVariant && !snapshot.isInav && (
        <p
          className="text-[11px] text-amber-400"
          data-testid="inav-msp-not-inav"
        >
          {t("inav.msp.notInav", { variant: snapshot.fcVariant })}
        </p>
      )}

      {snapshot && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
          <dt className="text-aether-fg-dim">{t("inav.msp.craftName")}</dt>
          <dd className="font-mono text-aether-fg">
            {snapshot.name?.trim() ? snapshot.name : "—"}
          </dd>

          <dt className="text-aether-fg-dim">{t("inav.msp.fcVariant")}</dt>
          <dd className="font-mono text-aether-fg">
            {snapshot.fcVariant ?? "—"}
          </dd>

          <dt className="text-aether-fg-dim">{t("inav.msp.fcVersion")}</dt>
          <dd className="font-mono text-aether-fg">{formatVersion(snapshot)}</dd>

          <dt className="text-aether-fg-dim">{t("inav.msp.apiVersion")}</dt>
          <dd className="font-mono text-aether-fg">{formatApi(snapshot)}</dd>

          <dt className="text-aether-fg-dim">{t("inav.msp.armed")}</dt>
          <dd
            className={cn(
              "font-mono",
              snapshot.status?.armed ? "text-amber-400" : "text-aether-fg",
            )}
          >
            {snapshot.status
              ? snapshot.status.armed
                ? t("inav.msp.armedYes")
                : t("inav.msp.armedNo")
              : "—"}
          </dd>

          <dt className="text-aether-fg-dim">{t("inav.msp.cycleTime")}</dt>
          <dd className="font-mono text-aether-fg">
            {snapshot.status
              ? t("inav.msp.cycleTimeValue", {
                  us: String(snapshot.status.cycleTime),
                })
              : "—"}
          </dd>

          {snapshot.status?.cpuLoad != null && (
            <>
              <dt className="text-aether-fg-dim">{t("inav.msp.cpuLoad")}</dt>
              <dd className="font-mono text-aether-fg">
                {snapshot.status.cpuLoad}
              </dd>
            </>
          )}

          <dt className="text-aether-fg-dim">{t("inav.msp.sensors")}</dt>
          <dd className="font-mono text-aether-fg">
            {sensors.length > 0
              ? sensors
                  .map((id) => {
                    const key = SENSOR_KEYS[id];
                    return key ? t(key) : id;
                  })
                  .join(", ")
              : "—"}
          </dd>

          <dt className="text-aether-fg-dim">{t("inav.msp.voltage")}</dt>
          <dd className="font-mono text-aether-fg">
            {snapshot.analog
              ? t("inav.msp.voltageValue", {
                  v: snapshot.analog.voltage.toFixed(1),
                })
              : "—"}
          </dd>

          <dt className="text-aether-fg-dim">{t("inav.msp.mah")}</dt>
          <dd className="font-mono text-aether-fg">
            {snapshot.analog ? String(snapshot.analog.mAhDrawn) : "—"}
          </dd>

          <dt className="text-aether-fg-dim">{t("inav.msp.gps")}</dt>
          <dd className="font-mono text-aether-fg">
            {snapshot.gps
              ? t("inav.msp.gpsValue", {
                  fix: mspGpsFixLabel(snapshot.gps.fix),
                  sats: String(snapshot.gps.numSat),
                })
              : "—"}
          </dd>

          {snapshot.gps && snapshot.gps.fix >= 2 && (
            <>
              <dt className="text-aether-fg-dim">{t("inav.msp.latLon")}</dt>
              <dd className="font-mono text-aether-fg">
                {snapshot.gps.lat.toFixed(6)}, {snapshot.gps.lon.toFixed(6)}
              </dd>
            </>
          )}
        </dl>
      )}

      {live && !snapshot && !polling && !errorText && (
        <p className="text-[11px] text-aether-fg-dim">{t("inav.msp.empty")}</p>
      )}
    </section>
  );
}
