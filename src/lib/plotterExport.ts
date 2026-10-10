import type { PlotPoint } from "@/stores/plotterStore";

export interface PlotterCsvOptions {
  /** Restrict to these channel ids; default = all keys seen in points. */
  channels?: string[];
  /** Slice of points to export (already windowed). */
  points: PlotPoint[];
}

/** Build CSV with index,t,channel… columns. */
export function plotPointsToCsv(options: PlotterCsvOptions): string {
  const { points } = options;
  const channels =
    options.channels ??
    Array.from(
      new Set(points.flatMap((p) => Object.keys(p.values))),
    ).sort();

  const header = ["index", "t", ...channels].join(",");
  if (points.length === 0) return `${header}\n`;

  const rows = points.map((p, i) => {
    const cols = [
      String(i),
      String(p.t),
      ...channels.map((ch) => {
        const v = p.values[ch];
        return v == null || !Number.isFinite(v) ? "" : String(v);
      }),
    ];
    return cols.join(",");
  });
  return `${header}\n${rows.join("\n")}\n`;
}

/**
 * Visible window into a ring buffer of samples.
 * `windowSize` = how many samples to show; `panFromEnd` = offset from the latest sample.
 */
export function slicePlotWindow(
  points: PlotPoint[],
  windowSize: number,
  panFromEnd: number,
): PlotPoint[] {
  if (points.length === 0) return [];
  const size = Math.max(1, Math.min(Math.floor(windowSize), points.length));
  const maxPan = Math.max(0, points.length - size);
  const pan = Math.max(0, Math.min(Math.floor(panFromEnd), maxPan));
  const end = points.length - pan;
  const start = Math.max(0, end - size);
  return points.slice(start, end);
}

export const PLOTTER_ZOOM_MIN = 20;
export const PLOTTER_ZOOM_MAX = 400;

export function clampPlotterZoom(samples: number): number {
  return Math.max(
    PLOTTER_ZOOM_MIN,
    Math.min(PLOTTER_ZOOM_MAX, Math.floor(samples)),
  );
}
