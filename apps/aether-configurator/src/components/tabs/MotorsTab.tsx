import { useEffect } from "react";
import { AlertTriangle, OctagonX, ShieldCheck } from "lucide-react";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/hooks/useI18n";
import { useConnectionStore } from "@/stores/connectionStore";
import { useUiStore } from "@/stores/uiStore";
import { useMotorsStore } from "@/stores/motorsStore";
import { MOTOR_STOP, MOTOR_TEST_MAX } from "@/core/protocols/msp/motors";

export function MotorsTab() {
  const { t } = useI18n();
  const connected = useConnectionStore((s) => s.connected);
  const armed = useConnectionStore((s) => s.snapshot.status?.armed ?? false);
  const activeTab = useUiStore((s) => s.activeTab);

  const propsRemoved = useMotorsStore((s) => s.propsRemoved);
  const masterEnable = useMotorsStore((s) => s.masterEnable);
  const values = useMotorsStore((s) => s.values);
  const telemetry = useMotorsStore((s) => s.telemetry);
  const error = useMotorsStore((s) => s.error);
  const notice = useMotorsStore((s) => s.notice);
  const setPropsRemoved = useMotorsStore((s) => s.setPropsRemoved);
  const enableMaster = useMotorsStore((s) => s.enableMaster);
  const disableMaster = useMotorsStore((s) => s.disableMaster);
  const setMotor = useMotorsStore((s) => s.setMotor);
  const stopAll = useMotorsStore((s) => s.stopAll);
  const refreshTelemetry = useMotorsStore((s) => s.refreshTelemetry);

  useEffect(() => {
    if (activeTab !== "motors") {
      disableMaster();
      return;
    }
    if (connected) {
      void refreshTelemetry();
      const id = setInterval(() => void refreshTelemetry(), 800);
      return () => {
        clearInterval(id);
        disableMaster();
      };
    }
    return () => disableMaster();
  }, [activeTab, connected]); // eslint-disable-line react-hooks/exhaustive-deps

  const errText =
    error === "PROPS_REQUIRED"
      ? t("motors.err.props")
      : error === "ARMED"
        ? t("motors.err.armed")
        : error;
  const noticeText =
    notice === "MASTER_ON"
      ? t("motors.masterOn")
      : notice === "MASTER_TIMEOUT"
        ? t("motors.masterTimeout")
        : null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-semibold">{t("motors.title")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-fg-muted">{t("motors.hint")}</p>
      </div>

      <Card className="border-warn/50">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
          <div>
            <CardTitle>{t("motors.safetyTitle")}</CardTitle>
            <CardHint className="mt-1 leading-relaxed">{t("motors.safetyBody")}</CardHint>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={propsRemoved}
                onChange={(e) => setPropsRemoved(e.target.checked)}
              />
              {t("motors.propsCheck")}
            </label>
          </div>
        </div>
      </Card>

      {(errText || noticeText) && (
        <Card className={errText ? "border-danger/40" : "border-ok/40"}>
          <p className={`text-sm ${errText ? "text-danger" : "text-ok"}`}>
            {errText ?? noticeText}
          </p>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Badge tone={armed ? "danger" : "ok"}>
          {armed ? t("dashboard.armed") : t("dashboard.disarmed")}
        </Badge>
        <Badge tone={masterEnable ? "danger" : "neutral"}>
          {masterEnable ? t("motors.enabled") : t("motors.disabled")}
        </Badge>
        <Button
          variant="primary"
          disabled={!connected || !propsRemoved || armed || masterEnable}
          onClick={enableMaster}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          {t("motors.enable")}
        </Button>
        <Button variant="danger" onClick={() => void stopAll().then(disableMaster)}>
          <OctagonX className="h-3.5 w-3.5" />
          {t("motors.stopAll")}
        </Button>
      </div>

      <Card>
        <CardTitle>{t("motors.sliders")}</CardTitle>
        <CardHint>
          {t("motors.sliderHint", { max: String(MOTOR_TEST_MAX) })}
        </CardHint>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {values.map((v, i) => (
            <label key={i} className="block text-xs">
              <div className="mb-1 flex justify-between font-mono">
                <span>M{i + 1}</span>
                <span>
                  {v}{" "}
                  <span className="text-fg-muted">/ tel {telemetry[i]}</span>
                </span>
              </div>
              <input
                type="range"
                className="w-full accent-[var(--color-accent)]"
                min={MOTOR_STOP}
                max={MOTOR_TEST_MAX}
                value={v}
                disabled={!masterEnable}
                onChange={(e) => setMotor(i, Number(e.target.value))}
              />
            </label>
          ))}
        </div>
      </Card>
    </div>
  );
}
