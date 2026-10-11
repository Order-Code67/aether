import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/hooks/useI18n";
import { useConnectionStore } from "@/stores/connectionStore";
import {
  mspGpsFixLabel,
  sensorsPresentLabels,
} from "@/core/protocols/msp/codec";

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-2/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-fg-muted">
        {label}
      </div>
      <div className="mt-1 font-display text-xl font-semibold tabular-nums">
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-fg-muted">{sub}</div>}
    </div>
  );
}

export function DashboardTab() {
  const { t } = useI18n();
  const connected = useConnectionStore((s) => s.connected);
  const snapshot = useConnectionStore((s) => s.snapshot);
  const lastPollError = useConnectionStore((s) => s.lastPollError);

  const fcVersion = snapshot.fcVersion
    ? `${snapshot.fcVersion.major}.${snapshot.fcVersion.minor}.${snapshot.fcVersion.patch}`
    : t("dashboard.unknown");
  const api = snapshot.apiVersion
    ? `${snapshot.apiVersion.apiMajor}.${snapshot.apiVersion.apiMinor}`
    : t("dashboard.unknown");
  const voltage = snapshot.analog
    ? `${snapshot.analog.voltage.toFixed(1)} V`
    : t("dashboard.unknown");
  const amps =
    snapshot.analog?.amperage != null
      ? `${snapshot.analog.amperage.toFixed(1)} A`
      : t("dashboard.unknown");
  const gps = snapshot.gps;
  const sensors = snapshot.status
    ? sensorsPresentLabels(snapshot.status.sensors).join(", ") || "—"
    : t("dashboard.unknown");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-semibold">
          {t("dashboard.title")}
        </h2>
        <p className="mt-1 text-sm text-fg-muted">{t("dashboard.hint")}</p>
      </div>

      {!connected && (
        <Card>
          <p className="text-sm text-fg-muted">{t("dashboard.noData")}</p>
        </Card>
      )}

      {lastPollError && (
        <Card className="border-danger/40">
          <p className="text-sm text-danger">{lastPollError}</p>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="mb-2 flex items-center justify-between gap-2">
            <CardTitle>{t("dashboard.fc")}</CardTitle>
            {snapshot.fcVariant && (
              <Badge tone="accent">{snapshot.fcVariant}</Badge>
            )}
          </div>
          <CardHint>
            {snapshot.name || t("dashboard.unknown")} · API {api}
          </CardHint>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat label="FW" value={fcVersion} />
            <Stat
              label="CPU"
              value={
                snapshot.status?.cpuLoad != null
                  ? `${snapshot.status.cpuLoad}%`
                  : t("dashboard.unknown")
              }
              sub={`cycle ${snapshot.status?.cycleTime ?? "—"} µs`}
            />
          </div>
        </Card>

        <Card>
          <CardTitle>{t("dashboard.battery")}</CardTitle>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat label="Vbat" value={voltage} />
            <Stat label="Current" value={amps} />
            <Stat
              label="mAh"
              value={
                snapshot.analog
                  ? String(snapshot.analog.mAhDrawn)
                  : t("dashboard.unknown")
              }
            />
            <Stat
              label="RSSI"
              value={
                snapshot.analog
                  ? String(snapshot.analog.rssi)
                  : t("dashboard.unknown")
              }
            />
          </div>
        </Card>

        <Card>
          <CardTitle>{t("dashboard.gps")}</CardTitle>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat
              label="Fix"
              value={gps ? mspGpsFixLabel(gps.fix) : t("dashboard.unknown")}
            />
            <Stat
              label="Sats"
              value={gps ? String(gps.numSat) : t("dashboard.unknown")}
            />
            <Stat
              label="Alt"
              value={gps ? `${gps.alt} m` : t("dashboard.unknown")}
            />
            <Stat
              label="Speed"
              value={gps ? `${gps.speed.toFixed(1)} m/s` : t("dashboard.unknown")}
            />
          </div>
          {gps && (
            <p className="mt-2 text-[11px] tabular-nums text-fg-muted">
              {gps.lat.toFixed(6)}, {gps.lon.toFixed(6)}
            </p>
          )}
        </Card>

        <Card>
          <div className="mb-2 flex items-center justify-between">
            <CardTitle>{t("dashboard.mode")}</CardTitle>
            <Badge tone={snapshot.status?.armed ? "danger" : "ok"}>
              {snapshot.status?.armed
                ? t("dashboard.armed")
                : t("dashboard.disarmed")}
            </Badge>
          </div>
          <CardHint>{t("dashboard.sensors")}</CardHint>
          <p className="mt-2 text-sm text-fg">{sensors}</p>
          <p className="mt-3 text-[11px] text-fg-muted">
            profile #{snapshot.status?.currentSet ?? "—"} · flags{" "}
            {snapshot.status
              ? `0x${snapshot.status.modeFlags.toString(16)}`
              : "—"}
          </p>
        </Card>
      </div>
    </div>
  );
}
