import { Crosshair, LocateFixed, Radio, RotateCcw } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import {
  formatEstimateHud,
  useOpticalNavStore,
} from "@/stores/opticalNavStore";
import { useSettingsStore } from "@/stores/settingsStore";

export function OpticalNavBar() {
  const { t } = useI18n();
  const flashNotice = useSettingsStore((s) => s.flashNotice);

  const enabled = useOpticalNavStore((s) => s.enabled);
  const altitudeM = useOpticalNavStore((s) => s.altitudeM);
  const fovHDeg = useOpticalNavStore((s) => s.fovHDeg);
  const headingDeg = useOpticalNavStore((s) => s.headingDeg);
  const anchorLat = useOpticalNavStore((s) => s.anchorLat);
  const anchorLon = useOpticalNavStore((s) => s.anchorLon);
  const anchorAltM = useOpticalNavStore((s) => s.anchorAltM);
  const hasAnchor = useOpticalNavStore((s) => s.hasAnchor);
  const syncFromFc = useOpticalNavStore((s) => s.syncFromFc);
  const injectVision = useOpticalNavStore((s) => s.injectVision);
  const logToSerial = useOpticalNavStore((s) => s.logToSerial);
  const estimate = useOpticalNavStore((s) => s.estimate);
  const lastError = useOpticalNavStore((s) => s.lastError);
  const lastFcSource = useOpticalNavStore((s) => s.lastFcSource);
  const lastInjectError = useOpticalNavStore((s) => s.lastInjectError);
  const framesProcessed = useOpticalNavStore((s) => s.framesProcessed);
  const injectCount = useOpticalNavStore((s) => s.injectCount);
  const processing = useOpticalNavStore((s) => s.processing);

  const setEnabled = useOpticalNavStore((s) => s.setEnabled);
  const setAltitudeM = useOpticalNavStore((s) => s.setAltitudeM);
  const setFovHDeg = useOpticalNavStore((s) => s.setFovHDeg);
  const setHeadingDeg = useOpticalNavStore((s) => s.setHeadingDeg);
  const setAnchorLat = useOpticalNavStore((s) => s.setAnchorLat);
  const setAnchorLon = useOpticalNavStore((s) => s.setAnchorLon);
  const setAnchorAltM = useOpticalNavStore((s) => s.setAnchorAltM);
  const setSyncFromFc = useOpticalNavStore((s) => s.setSyncFromFc);
  const setInjectVision = useOpticalNavStore((s) => s.setInjectVision);
  const setLogToSerial = useOpticalNavStore((s) => s.setLogToSerial);
  const applyAnchor = useOpticalNavStore((s) => s.applyAnchor);
  const applyAnchorFromFc = useOpticalNavStore((s) => s.applyAnchorFromFc);
  const clearAnchor = useOpticalNavStore((s) => s.clearAnchor);
  const resetPose = useOpticalNavStore((s) => s.resetPose);

  const hud = formatEstimateHud(estimate);

  const onApplyAnchor = () => {
    if (applyAnchor()) {
      flashNotice(t("opticalNav.anchorSet"), 2500);
    } else {
      flashNotice(t("opticalNav.anchorInvalid"));
    }
  };

  const onAnchorFromFc = () => {
    if (applyAnchorFromFc()) {
      flashNotice(t("opticalNav.anchorFromFcOk"), 2500);
    } else {
      flashNotice(t("opticalNav.anchorFromFcFail"));
    }
  };

  const injectErrorLabel =
    lastInjectError === "SERIAL_NOT_CONNECTED"
      ? t("opticalNav.injectNoSerial")
      : lastInjectError === "MSP_POLL_BUSY"
        ? t("opticalNav.injectMspBusy")
        : lastInjectError;

  return (
    <div className="border-b border-aether-border bg-aether-surface/60 px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Crosshair size={13} className="text-aether-fg-muted" />
        <label className="flex items-center gap-1.5 text-[11px] text-aether-fg">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          {t("opticalNav.enable")}
        </label>
        <label className="flex items-center gap-1 text-[11px] text-aether-fg-dim">
          {t("opticalNav.alt")}
          <input
            type="number"
            min={0.1}
            step={0.5}
            value={altitudeM}
            onChange={(e) => setAltitudeM(Number(e.target.value) || 0.1)}
            className="h-6 w-14 rounded border border-aether-border bg-aether-bg px-1 font-mono text-[11px] text-aether-fg"
          />
          m
        </label>
        <label className="flex items-center gap-1 text-[11px] text-aether-fg-dim">
          {t("opticalNav.fov")}
          <input
            type="number"
            min={1}
            max={170}
            step={1}
            value={fovHDeg}
            onChange={(e) => setFovHDeg(Number(e.target.value) || 66)}
            className="h-6 w-12 rounded border border-aether-border bg-aether-bg px-1 font-mono text-[11px] text-aether-fg"
          />
          °
        </label>
        <label className="flex items-center gap-1 text-[11px] text-aether-fg-dim">
          {t("opticalNav.heading")}
          <input
            type="number"
            min={0}
            max={359}
            step={1}
            value={Math.round(headingDeg)}
            onChange={(e) => setHeadingDeg(Number(e.target.value) || 0)}
            className="h-6 w-12 rounded border border-aether-border bg-aether-bg px-1 font-mono text-[11px] text-aether-fg"
          />
          °
        </label>
        <button
          type="button"
          onClick={() => resetPose()}
          title={t("opticalNav.reset")}
          aria-label={t("opticalNav.reset")}
          className="flex h-6 items-center gap-1 rounded border border-aether-border px-1.5 text-[11px] text-aether-fg hover:bg-aether-surface-raised"
        >
          <RotateCcw size={11} />
          {t("opticalNav.reset")}
        </button>
        <span
          className={cn(
            "ml-auto text-[11px]",
            processing ? "text-aether-accent" : "text-aether-fg-dim",
          )}
        >
          {enabled
            ? t("opticalNav.frames", { count: framesProcessed })
            : t("opticalNav.off")}
        </span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <Radio size={12} className="text-aether-fg-muted" />
        <label className="flex items-center gap-1.5 text-[11px] text-aether-fg">
          <input
            type="checkbox"
            checked={syncFromFc}
            onChange={(e) => setSyncFromFc(e.target.checked)}
          />
          {t("opticalNav.syncFc")}
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-aether-fg">
          <input
            type="checkbox"
            checked={injectVision}
            onChange={(e) => setInjectVision(e.target.checked)}
          />
          {t("opticalNav.injectVision")}
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-aether-fg">
          <input
            type="checkbox"
            checked={logToSerial}
            onChange={(e) => setLogToSerial(e.target.checked)}
          />
          {t("opticalNav.logSerial")}
        </label>
        {syncFromFc && lastFcSource && (
          <span className="text-[10px] text-aether-fg-dim">
            {t("opticalNav.fcSource", { source: lastFcSource })}
          </span>
        )}
        {injectVision && (
          <span className="text-[10px] text-aether-fg-dim">
            {t("opticalNav.injectCount", { count: injectCount })}
          </span>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <LocateFixed size={12} className="text-aether-fg-muted" />
        <input
          type="text"
          value={anchorLat}
          onChange={(e) => setAnchorLat(e.target.value)}
          placeholder={t("opticalNav.latPlaceholder")}
          aria-label={t("opticalNav.lat")}
          className="h-6 w-[7.5rem] rounded border border-aether-border bg-aether-bg px-1 font-mono text-[11px] text-aether-fg"
        />
        <input
          type="text"
          value={anchorLon}
          onChange={(e) => setAnchorLon(e.target.value)}
          placeholder={t("opticalNav.lonPlaceholder")}
          aria-label={t("opticalNav.lon")}
          className="h-6 w-[7.5rem] rounded border border-aether-border bg-aether-bg px-1 font-mono text-[11px] text-aether-fg"
        />
        <label className="flex items-center gap-1 text-[11px] text-aether-fg-dim">
          {t("opticalNav.anchorAlt")}
          <input
            type="number"
            step={1}
            value={anchorAltM}
            onChange={(e) => setAnchorAltM(Number(e.target.value) || 0)}
            className="h-6 w-12 rounded border border-aether-border bg-aether-bg px-1 font-mono text-[11px] text-aether-fg"
          />
        </label>
        <button
          type="button"
          onClick={onApplyAnchor}
          className="h-6 rounded border border-aether-border px-2 text-[11px] text-aether-fg hover:bg-aether-surface-raised"
        >
          {t("opticalNav.setAnchor")}
        </button>
        <button
          type="button"
          onClick={onAnchorFromFc}
          className="h-6 rounded border border-aether-border px-2 text-[11px] text-aether-fg hover:bg-aether-surface-raised"
        >
          {t("opticalNav.anchorFromFc")}
        </button>
        {hasAnchor && (
          <button
            type="button"
            onClick={() => clearAnchor()}
            className="h-6 rounded px-1.5 text-[11px] text-aether-fg-muted hover:text-aether-fg"
          >
            {t("opticalNav.clearAnchor")}
          </button>
        )}
      </div>

      {enabled && (
        <div className="mt-1.5 grid gap-0.5 font-mono text-[10px] text-aether-fg-dim sm:grid-cols-2">
          <div className="sm:col-span-2 text-[12px] text-aether-fg">
            <span className="mr-2 text-aether-fg-dim">{t("opticalNav.home")}:</span>
            <span className="mr-2 text-base leading-none" aria-hidden>
              {hud.homeArrow}
            </span>
            <span>{hud.home}</span>
          </div>
          <div>
            {t("opticalNav.ned")}:{" "}
            <span className="text-aether-fg">{hud.ned}</span>
          </div>
          <div>
            {t("opticalNav.geo")}:{" "}
            <span className="text-aether-fg">{hud.geo}</span>
          </div>
          <div>
            {t("opticalNav.vel")}:{" "}
            <span className="text-aether-fg">{hud.vel}</span>
          </div>
          <div>
            {t("opticalNav.quality")}:{" "}
            <span className="text-aether-fg">{hud.quality}</span>
          </div>
        </div>
      )}

      {lastError && (
        <p className="mt-1 text-[10px] text-aether-danger">{lastError}</p>
      )}
      {injectErrorLabel && (
        <p className="mt-1 text-[10px] text-aether-danger">{injectErrorLabel}</p>
      )}

      <p className="mt-1 text-[10px] text-aether-fg-muted">{t("opticalNav.hint")}</p>
    </div>
  );
}
