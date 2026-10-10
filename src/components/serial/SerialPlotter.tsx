import { useEffect, useRef } from "react";
import { Eraser, Pause, Play } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { channelColor } from "@/lib/serialPlotter";
import { cn } from "@/lib/cn";
import { usePlotterStore } from "@/stores/plotterStore";
import { useSerialStore } from "@/stores/serialStore";

export function SerialPlotter() {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paused = usePlotterStore((s) => s.paused);
  const parseMode = usePlotterStore((s) => s.parseMode);
  const points = usePlotterStore((s) => s.points);
  const channels = usePlotterStore((s) => s.channels);
  const visibility = usePlotterStore((s) => s.visibility);
  const vehicle = usePlotterStore((s) => s.vehicle);
  const setPaused = usePlotterStore((s) => s.setPaused);
  const setParseMode = usePlotterStore((s) => s.setParseMode);
  const toggleChannel = usePlotterStore((s) => s.toggleChannel);
  const clear = usePlotterStore((s) => s.clear);
  const connected = useSerialStore((s) => s.connected);

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
      if (points.length === 0 || visible.length === 0) {
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
      for (const p of points) {
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

      const n = Math.max(points.length - 1, 1);
      visible.forEach((ch) => {
        const color = channelColor(channels.indexOf(ch));
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let started = false;
        points.forEach((p, i) => {
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
  }, [points, channels, visibility, connected, parseMode, t]);

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
        <button
          type="button"
          title={paused ? t("plotter.resume") : t("plotter.pause")}
          aria-label={paused ? t("plotter.resume") : t("plotter.pause")}
          onClick={() => setPaused(!paused)}
          className="flex h-7 items-center gap-1 rounded border border-aether-border px-2 text-[11px] text-aether-fg hover:bg-aether-surface-raised"
        >
          {paused ? <Play size={13} /> : <Pause size={13} />}
          {paused ? t("plotter.resume") : t("plotter.pause")}
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
        {parseMode === "mavlink" && vehicle && (
          <span className="text-[11px] text-aether-fg-muted">
            {t("plotter.vehicle", {
              type: vehicle.vehicleType,
              armed: vehicle.armed
                ? t("plotter.armed")
                : t("plotter.disarmed"),
            })}
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
      <div className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="absolute inset-0" />
      </div>
    </div>
  );
}
