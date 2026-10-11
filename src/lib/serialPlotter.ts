/** Parse a serial line into named numeric channels for the plotter. */

export type PlotSample = Record<string, number>;

const KEY_VALUE_RE =
  /([A-Za-z_][\w]*)\s*[:=]\s*(-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;

const PLAIN_NUMBER_RE = /-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;

/**
 * Extract numeric series from a line.
 * Supports `temp:23.5`, `value=12`, and CSV / space-separated numbers (`23.5,40.1`).
 */
export function parseSerialPlotLine(line: string): PlotSample | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const named: PlotSample = {};
  let match: RegExpExecArray | null;
  KEY_VALUE_RE.lastIndex = 0;
  while ((match = KEY_VALUE_RE.exec(trimmed)) !== null) {
    const key = match[1];
    const raw = match[2];
    if (!key || raw === undefined) continue;
    const value = Number(raw);
    if (Number.isFinite(value)) {
      named[key] = value;
    }
  }
  if (Object.keys(named).length > 0) {
    return named;
  }

  // CSV / whitespace list without keys → ch0, ch1, …
  const nums = trimmed.match(PLAIN_NUMBER_RE);
  if (!nums || nums.length === 0) return null;

  // Avoid treating bare log timestamps / single IDs as plots unless multi-value or CSV-like
  const csvLike = /[,;\t]/.test(trimmed) || nums.length >= 2;
  if (!csvLike && nums.length === 1) {
    // Single bare number is useful for simple sketches
    const value = Number(nums[0]);
    if (!Number.isFinite(value)) return null;
    return { value };
  }

  const sample: PlotSample = {};
  nums.forEach((raw, i) => {
    const value = Number(raw);
    if (Number.isFinite(value)) {
      sample[`ch${i}`] = value;
    }
  });
  return Object.keys(sample).length > 0 ? sample : null;
}

export const PLOTTER_COLORS = [
  "#3d9eff",
  "#f59e0b",
  "#34d399",
  "#f472b6",
  "#a78bfa",
  "#fb7185",
  "#22d3ee",
  "#eab308",
] as const;

export function channelColor(index: number): string {
  return PLOTTER_COLORS[index % PLOTTER_COLORS.length]!;
}

const RADIO_CHANNEL_PRIORITY = ["RSSI", "SNR", "rssi", "snr", "Rssi", "Snr"];

/** True when sample looks like LoRa / radio telemetry. */
export function sampleHasRadioChannels(sample: PlotSample): boolean {
  return Object.keys(sample).some((k) =>
    /^(rssi|snr)$/i.test(k),
  );
}

/** Prefer RSSI/SNR first so they stay visible in the plotter legend. */
export function orderPlotChannels(channels: string[]): string[] {
  const radio: string[] = [];
  const rest: string[] = [];
  for (const c of channels) {
    if (/^(rssi|snr)$/i.test(c)) radio.push(c);
    else rest.push(c);
  }
  radio.sort((a, b) => {
    const ia = RADIO_CHANNEL_PRIORITY.findIndex((p) => p.toLowerCase() === a.toLowerCase());
    const ib = RADIO_CHANNEL_PRIORITY.findIndex((p) => p.toLowerCase() === b.toLowerCase());
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return [...radio, ...rest];
}

