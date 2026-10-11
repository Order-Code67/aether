import { useEffect } from "react";
import {
  AlertTriangle,
  Compass,
  Crosshair,
  Gauge,
  Radio,
  Waves,
} from "lucide-react";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AttitudeWidget } from "@/components/tabs/setup/AttitudeWidget";
import { RcChannelBars } from "@/components/tabs/setup/RcChannelBars";
import { useI18n } from "@/hooks/useI18n";
import { useConnectionStore } from "@/stores/connectionStore";
import { useSetupStore } from "@/stores/setupStore";
import { sensorsPresentLabels } from "@/core/protocols/msp/codec";
import { useUiStore } from "@/stores/uiStore";

function Vec({
  label,
  x,
  y,
  z,
}: {
  label: string;
  x: number;
  y: number;
  z: number;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-2/50 px-2 py-1.5 font-mono text-[11px]">
      <div className="text-[10px] uppercase text-fg-muted">{label}</div>
      <div className="mt-0.5 tabular-nums text-fg">
        {x} / {y} / {z}
      </div>
    </div>
  );
}

export function SetupTab() {
  const { t } = useI18n();
  const connected = useConnectionStore((s) => s.connected);
  const snapshot = useConnectionStore((s) => s.snapshot);
  const activeTab = useUiStore((s) => s.activeTab);

  const live = useSetupStore((s) => s.live);
  const attitude = useSetupStore((s) => s.attitude);
  const rc = useSetupStore((s) => s.rc);
  const imu = useSetupStore((s) => s.imu);
  const busy = useSetupStore((s) => s.busy);
  const notice = useSetupStore((s) => s.notice);
  const error = useSetupStore((s) => s.error);
  const startLive = useSetupStore((s) => s.startLive);
  const stopLive = useSetupStore((s) => s.stopLive);
  const calibrateAcc = useSetupStore((s) => s.calibrateAcc);
  const calibrateMag = useSetupStore((s) => s.calibrateMag);
  const clearNotice = useSetupStore((s) => s.clearNotice);

  const armed = snapshot.status?.armed ?? false;
  const sensors = snapshot.status
    ? sensorsPresentLabels(snapshot.status.sensors)
    : [];
  const hasMag = sensors.includes("mag");
  const hasAcc = sensors.includes("acc") || sensors.includes("gyro");

  useEffect(() => {
    if (activeTab !== "setup") {
      stopLive();
      return;
    }
    if (connected) startLive();
    else stopLive();
    return () => stopLive();
  }, [activeTab, connected, startLive, stopLive]);

  function confirmAcc() {
    clearNotice();
    if (!window.confirm(t("setup.acc.confirm"))) return;
    void calibrateAcc();
  }

  function confirmMag() {
    clearNotice();
    if (!window.confirm(t("setup.mag.confirm"))) return;
    void calibrateMag();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">
            {t("setup.title")}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-fg-muted">
            {t("setup.hint")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={live ? "ok" : "neutral"}>
            {live ? t("setup.liveOn") : t("setup.liveOff")}
          </Badge>
          <Badge tone={armed ? "danger" : "ok"}>
            {armed ? t("dashboard.armed") : t("dashboard.disarmed")}
          </Badge>
        </div>
      </div>

      {!connected && (
        <Card>
          <p className="text-sm text-fg-muted">{t("setup.needConnect")}</p>
        </Card>
      )}

      {(notice || error) && (
        <Card
          className={
            error ? "border-danger/40" : "border-ok/40"
          }
        >
          <p className={`text-sm ${error ? "text-danger" : "text-ok"}`}>
            {error === "ARMED"
              ? t("setup.err.armed")
              : error === "NOT_CONNECTED"
                ? t("setup.needConnect")
                : error
                  ? error
                  : notice === "ACC_OK"
                    ? t("setup.acc.ok")
                    : notice === "MAG_OK"
                      ? t("setup.mag.ok")
                      : notice}
          </p>
        </Card>
      )}

      <div className="grid gap-3 xl:grid-cols-3">
        {/* Sensors + attitude */}
        <Card className="xl:col-span-1">
          <div className="mb-2 flex items-center gap-2">
            <Gauge className="h-4 w-4 text-accent" />
            <CardTitle>{t("setup.sensors.title")}</CardTitle>
          </div>
          <CardHint>{t("setup.sensors.hint")}</CardHint>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(["gyro", "acc", "mag", "baro", "gps", "sonar"] as const).map(
              (id) => (
                <Badge
                  key={id}
                  tone={sensors.includes(id) ? "ok" : "neutral"}
                >
                  {id}
                </Badge>
              ),
            )}
          </div>
          <div className="mt-4">
            <AttitudeWidget attitude={attitude} />
          </div>
        </Card>

        {/* Acc / Gyro / Mag cal */}
        <Card className="space-y-4 xl:col-span-1">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Crosshair className="h-4 w-4 text-accent" />
              <CardTitle>{t("setup.acc.title")}</CardTitle>
            </div>
            <CardHint>{t("setup.acc.hint")}</CardHint>
            <Button
              className="mt-3"
              variant="primary"
              disabled={!connected || busy || armed || !hasAcc}
              onClick={confirmAcc}
            >
              {t("setup.acc.action")}
            </Button>
          </div>

          <div className="border-t border-border pt-4">
            <div className="mb-1 flex items-center gap-2">
              <Waves className="h-4 w-4 text-accent" />
              <CardTitle>{t("setup.gyro.title")}</CardTitle>
            </div>
            <CardHint>{t("setup.gyro.hint")}</CardHint>
            {imu && (
              <div className="mt-3 grid grid-cols-1 gap-2">
                <Vec label="Gyro" x={imu.gyro.x} y={imu.gyro.y} z={imu.gyro.z} />
                <Vec label="Acc" x={imu.acc.x} y={imu.acc.y} z={imu.acc.z} />
              </div>
            )}
          </div>

          <div className="border-t border-border pt-4">
            <div className="mb-1 flex items-center gap-2">
              <Compass className="h-4 w-4 text-accent" />
              <CardTitle>{t("setup.mag.title")}</CardTitle>
            </div>
            <CardHint>{t("setup.mag.hint")}</CardHint>
            {imu && hasMag && (
              <div className="mt-2">
                <Vec label="Mag" x={imu.mag.x} y={imu.mag.y} z={imu.mag.z} />
              </div>
            )}
            <Button
              className="mt-3"
              variant="secondary"
              disabled={!connected || busy || armed || !hasMag}
              onClick={confirmMag}
            >
              {t("setup.mag.action")}
            </Button>
          </div>
        </Card>

        {/* Radio */}
        <Card className="xl:col-span-1">
          <div className="mb-2 flex items-center gap-2">
            <Radio className="h-4 w-4 text-accent" />
            <CardTitle>{t("setup.radio.title")}</CardTitle>
          </div>
          <CardHint>{t("setup.radio.hint")}</CardHint>
          <div className="mt-3">
            {rc ? (
              <RcChannelBars rc={rc} />
            ) : (
              <p className="text-xs text-fg-muted">{t("setup.radio.empty")}</p>
            )}
          </div>
        </Card>
      </div>

      {/* ESC */}
      <Card>
        <div className="flex flex-wrap items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
          <div className="min-w-0 flex-1">
            <CardTitle>{t("setup.esc.title")}</CardTitle>
            <CardHint className="mt-1 leading-relaxed">
              {t("setup.esc.hint")}
            </CardHint>
            <p className="mt-2 text-xs text-fg-muted">{t("setup.esc.safety")}</p>
          </div>
        </div>
      </Card>

      <p className="text-[11px] text-fg-muted">{t("setup.eepromNote")}</p>
    </div>
  );
}
