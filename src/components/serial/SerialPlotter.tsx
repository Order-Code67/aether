import { useEffect, useMemo, useRef } from "react";
import {
  Download,
  Eraser,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
} from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { gpsFixLabel } from "@/lib/mavlinkMinimal";
import { plotPointsToCsv, slicePlotWindow } from "@/lib/plotterExport";
import { channelColor, sampleHasRadioChannels } from "@/lib/serialPlotter";
import { cn } from "@/lib/cn";
import { isTauriRuntime } from "@/lib/tauri";
import { usePlotterStore } from "@/stores/plotterStore";
import { useSerialStore } from "@/stores/serialStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { documentDir, join } from "@tauri-apps/api/path";
import { save } from "@tauri-apps/plugin-dialog";
import { mkdir, writeTextFile } from "@tauri-apps/plugin-fs";

function fmtCoord(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(6);
}

function fmtNum(v: number | null, digits = 1, suffix = ""): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(digits)}${suffix}`;
}

export function SerialPlotter() {
  const { t, locale } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paused = usePlotterStore((s) => s.paused);
  const parseMode = usePlotterStore((s) => s.parseMode);
  const points = usePlotterStore((s) => s.points);
  const channels = usePlotterStore((s) => s.channels);
  const visibility = usePlotterStore((s) => s.visibility);
  const vehicle = usePlotterStore((s) => s.vehicle);
  const zoomSamples = usePlotterStore((s) => s.zoomSamples);
  const panFromEnd = usePlotterStore((s) => s.panFromEnd);
  const setPaused = usePlotterStore((s) => s.setPaused);
  const setParseMode = usePlotterStore((s) => s.setParseMode);
  const toggleChannel = usePlotterStore((s) => s.toggleChannel);
  const clear = usePlotterStore((s) => s.clear);
  const zoomIn = usePlotterStore((s) => s.zoomIn);
  const zoomOut = usePlotterStore((s) => s.zoomOut);
  const resetZoom = usePlotterStore((s) => s.resetZoom);
  const nudgePan = usePlotterStore((s) => s.nudgePan);
  const connected = useSerialStore((s) => s.connected);
  const flashNotice = useSettingsStore((s) => s.flashNotice);

  const visiblePoints = useMemo(
    () => slicePlotWindow(points, zoomSamples, panFromEnd),
    [points, zoomSamples, panFromEnd],
  );
  const hasRadio = useMemo(
    () =>
      channels.some((c) => /^(rssi|snr)$/i.test(c)) ||
      points.some((p) => sampleHasRadioChannels(p.values)),
    [channels, points],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (w < 2 || h < 2) return;

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const pad = { l: 40, r: 8, t: 8, b: 20 };
      const plotW = w - pad.l - pad.r;
      const plotH = h - pad.t - pad.b;

      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = pad.t + (plotH * i) / 4;
        ctx.beginPath();
        ctx.moveTo(pad.l, y);
        ctx.lineTo(pad.l + plotW, y);
        ctx.stroke();
      }

      const visible = channels.filter((c) => visibility[c] !== false);
      if (visiblePoints.length === 0 || visible.length === 0) {
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
        ctx.fillText(
          connected
            ? parseMode === "mavlink"
              ? t("plotter.waitingMavlink")
              : t("plotter.waiting")
            : t("plotter.connectHint"),
          pad.l + 8,
          pad.t + 18,
        );
        return;
      }

      let min = Infinity;
      let max = -Infinity;
      for (const p of visiblePoints) {
        for (const ch of visible) {
          const v = p.values[ch];
          if (v == null || !Number.isFinite(v)) continue;
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
      if (!Number.isFinite(min) || !Number.isFinite(max)) return;
      if (min === max) {
        min -= 1;
        max += 1;
      }

      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = "10px ui-monospace, Consolas, monospace";
      ctx.textAlign = "right";
      ctx.fillText(max.toFixed(2), pad.l - 4, pad.t + 10);
      ctx.fillText(min.toFixed(2), pad.l - 4, pad.t + plotH);

      const n = Math.max(visiblePoints.length - 1, 1);
      visible.forEach((ch) => {
        const color = channelColor(channels.indexOf(ch));
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let started = false;
        visiblePoints.forEach((p, i) => {
          const v = p.values[ch];
          if (v == null || !Number.isFinite(v)) {
            started = false;
            return;
          }
          const x = pad.l + (plotW * i) / n;
          const y = pad.t + plotH * (1 - (v - min) / (max - min));
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();
      });
    };

    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(parent);
    return () => ro.disconnect();
  }, [visiblePoints, channels, visibility, connected, parseMode, t]);

  const exportCsv = async (scope: "visible" | "all") => {
    if (!isTauriRuntime()) {
      flashNotice(t("plotter.desktopOnly"));
      return;
    }
    const visibleCh = channels.filter((c) => visibility[c] !== false);
    const data = scope === "visible" ? visiblePoints : points;
    if (data.length === 0) {
      flashNotice(t("plotter.exportEmpty"));
      return;
    }
    const csv = plotPointsToCsv({
      points: data,
      channels: visibleCh.length > 0 ? visibleCh : channels,
    });
    try {
      const docs = await documentDir();
      const dir = await join(docs, "Aether", "plotter");
      await mkdir(dir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const suggested = await join(dir, `plot-${scope}-${stamp}.csv`);
      const chosen = await save({
        title: locale === "ru" ? "Экспорт CSV плоттера" : "Export plotter CSV",
        defaultPath: suggested,
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });
      if (typeof chosen !== "string" || !chosen) return;
      await writeTextFile(chosen, csv);
      flashNotice(t("plotter.exported", { count: data.length }), 3000);
    } catch (e) {
      flashNotice(
        e instanceof Error ? e.message : t("plotter.exportFailed"),
      );
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-aether-border px-2 py-1.5">
        <div
          className="flex h-7 items-center rounded border border-aether-border p-0.5 text-[11px]"
          role="group"
          aria-label={t("plotter.mode")}
        >
          <button
            type="button"
            onClick={() => setParseMode("text")}
            className={cn(
              "rounded px-2 py-0.5",
              parseMode === "text"
                ? "bg-aether-accent-muted text-aether-fg"
                : "text-aether-fg-muted hover:text-aether-fg",
            )}
          >
            {t("plotter.modeText")}
          </button>
          <button
            type="button"
            onClick={() => setParseMode("mavlink")}
            className={cn(
              "rounded px-2 py-0.5",
              parseMode === "mavlink"
                ? "bg-aether-accent-muted text-aether-fg"
                : "text-aether-fg-muted hover:text-aether-fg",
            )}
          >
            {t("plotter.modeMavlink")}
          </button>
        </div>
        {hasRadio && parseMode === "text" && (
          <span
            className="rounded border border-aether-accent/40 bg-aether-accent/10 px-1.5 py-0.5 text-[10px] text-aether-fg"
            title={t("plotter.radioHint")}
          >
            {t("plotter.radioBadge")}
          </span>
        )}
        <button
          type="button"
          title={paused ? t("plotter.resume") : t("plotter.pause")}
          aria-label={paused ? t("plotter.resume") : t("plotter.pause")}
          aria-pressed={paused}
          onClick={() => setPaused(!paused)}
          className={cn(
            "flex h-7 items-center gap-1 rounded border px-2 text-[11px]",
            paused
              ? "border-aether-accent bg-aether-accent-muted text-aether-fg"
              : "border-aether-border text-aether-fg hover:bg-aether-surface-raised",
          )}
        >
          {paused ? <Play size={13} /> : <Pause size={13} />}
          {paused ? t("plotter.resume") : t("plotter.pause")}
        </button>
        <div
          className="flex h-7 items-center gap-0.5 rounded border border-aether-border px-0.5"
          role="group"
          aria-label={t("plotter.zoom")}
        >
          <button
            type="button"
            title={t("plotter.zoomOut")}
            aria-label={t("plotter.zoomOut")}
            onClick={zoomOut}
            className="flex h-6 w-6 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
          >
            <Minus size={13} />
          </button>
          <span className="min-w-[3.5rem] text-center font-mono text-[10px] text-aether-fg-dim">
            {Math.min(zoomSamples, points.length || zoomSamples)}
          </span>
          <button
            type="button"
            title={t("plotter.zoomIn")}
            aria-label={t("plotter.zoomIn")}
            onClick={zoomIn}
            className="flex h-6 w-6 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
          >
            <Plus size={13} />
          </button>
          <button
            type="button"
            title={t("plotter.zoomReset")}
            aria-label={t("plotter.zoomReset")}
            onClick={resetZoom}
            className="flex h-6 w-6 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
          >
            <RotateCcw size={12} />
          </button>
        </div>
        <button
          type="button"
          title={t("plotter.exportCsv")}
          aria-label={t("plotter.exportCsv")}
          onClick={() => {
            const scope = window.confirm(t("plotter.exportScope"))
              ? "visible"
              : "all";
            void exportCsv(scope);
          }}
          className="flex h-7 items-center gap-1 rounded border border-aether-border px-2 text-[11px] text-aether-fg hover:bg-aether-surface-raised"
        >
          <Download size={13} />
          {t("plotter.exportCsv")}
        </button>
        <button
          type="button"
          title={t("plotter.clear")}
          aria-label={t("plotter.clear")}
          onClick={clear}
          className="flex h-7 w-7 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
        >
          <Eraser size={13} />
        </button>
        <span className="ml-1 text-[11px] text-aether-fg-dim">
          {parseMode === "mavlink" ? t("plotter.hintMavlink") : t("plotter.hint")}
        </span>
        {paused && (
          <span className="rounded bg-aether-accent-muted px-1.5 py-0.5 text-[10px] font-medium text-aether-fg">
            {t("plotter.pausedBadge")}
          </span>
        )}
        <div className="ml-auto flex max-w-full flex-wrap items-center gap-1">
          {channels.map((ch, i) => {
            const on = visibility[ch] !== false;
            return (
              <button
                key={ch}
                type="button"
                onClick={() => toggleChannel(ch)}
                className={cn(
                  "flex h-6 items-center gap-1 rounded border px-1.5 font-mono text-[10px]",
                  on
                    ? "border-aether-border text-aether-fg"
                    : "border-aether-border/50 text-aether-fg-dim line-through",
                )}
                title={t("plotter.toggleChannel", { channel: ch })}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{
                    background: on ? channelColor(i) : "transparent",
                    outline: `1px solid ${channelColor(i)}`,
                  }}
                />
                {ch}
              </button>
            );
          })}
        </div>
      </div>
      {parseMode === "mavlink" && vehicle && (
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-aether-border bg-aether-surface/60 px-2 py-1 font-mono text-[10px] text-aether-fg-muted"
          role="status"
          aria-label={t("plotter.hud")}
        >
          <span
            className={cn(
              "rounded px-1.5 py-0.5 font-sans text-[10px] font-medium uppercase tracking-wide",
              vehicle.armed
                ? "bg-aether-danger/20 text-aether-danger"
                : "bg-aether-surface-raised text-aether-fg-dim",
            )}
          >
            {vehicle.armed ? t("plotter.armed") : t("plotter.disarmed")}
          </span>
          <span title={t("plotter.hudType")}>
            {vehicle.vehicleType}
            {vehicle.customMode
              ? ` · mode ${vehicle.customMode}`
              : ""}
          </span>
          <span title={t("plotter.hudGps")}>
            GPS {gpsFixLabel(vehicle.fixType)}
            {vehicle.satellites != null ? ` · ${vehicle.satellites}sat` : ""}
          </span>
          <span title={t("plotter.hudBattery")}>
            {vehicle.batteryRemaining != null
              ? `${vehicle.batteryRemaining}%`
              : "—%"}
            {vehicle.voltage != null
              ? ` · ${fmtNum(vehicle.voltage, 2, "V")}`
              : ""}
            {vehicle.current != null
              ? ` · ${fmtNum(vehicle.current, 1, "A")}`
              : ""}
          </span>
          <span title={t("plotter.hudPosition")}>
            {fmtCoord(vehicle.lat)}, {fmtCoord(vehicle.lon)}
          </span>
          {(vehicle.alt != null || vehicle.groundspeed != null) && (
            <span>
              {vehicle.alt != null ? `${fmtNum(vehicle.alt, 1, "m")}` : ""}
              {vehicle.groundspeed != null
                ? ` · ${fmtNum(vehicle.groundspeed, 1, "m/s")}`
                : ""}
              {vehicle.heading != null
                ? ` · hdg ${Math.round(vehicle.heading)}°`
                : ""}
            </span>
          )}
        </div>
      )}
      <div
        className="relative min-h-0 flex-1"
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.deltaY < 0) zoomIn();
            else zoomOut();
          } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
            e.preventDefault();
            const delta = Math.sign(e.deltaX || e.deltaY) * Math.max(1, Math.round(zoomSamples / 20));
            nudgePan(delta);
          }
        }}
      >
        <canvas ref={canvasRef} className="absolute inset-0" />
      </div>
    </div>
  );
}
