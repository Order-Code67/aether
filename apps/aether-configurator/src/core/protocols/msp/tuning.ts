/**
 * MSP PID / RC tuning / Filter config (Betaflight & iNav-compatible subset).
 * Writes update RAM only — persist with CLI `save`.
 */

export type AxisId = "roll" | "pitch" | "yaw";

export interface PidAxis {
  p: number;
  i: number;
  d: number;
  /** Feed-forward — not in legacy MSP_PID; kept for UI / future CLI. */
  ff: number;
}

export interface PidProfile {
  roll: PidAxis;
  pitch: PidAxis;
  yaw: PidAxis;
}

export interface RatesProfile {
  rcRate: number;
  rcExpo: number;
  rollRate: number;
  pitchRate: number;
  yawRate: number;
  tpaRate: number;
  thrMid: number;
  thrExpo: number;
  tpaBreakpoint: number;
  rcYawExpo: number;
  rcYawRate: number;
  /** Original MSP payload for safe round-trip writes. */
  raw: Uint8Array;
}

export interface FilterConfig {
  gyroLowpassHz: number;
  dtermLowpassHz: number;
  yawLowpassHz: number;
  gyroNotchHz: number;
  gyroNotchCutoff: number;
  dtermNotchHz: number;
  dtermNotchCutoff: number;
  /** Original MSP payload for safe round-trip writes. */
  raw: Uint8Array;
}

function clampU8(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function clampU16(n: number): number {
  return Math.max(0, Math.min(65535, Math.round(n)));
}

function readU16LE(buf: Uint8Array, off: number): number {
  return (buf[off]! | (buf[off + 1]! << 8)) >>> 0;
}

function writeU16LE(buf: Uint8Array, off: number, value: number): void {
  const v = clampU16(value);
  buf[off] = v & 0xff;
  buf[off + 1] = (v >> 8) & 0xff;
}

function emptyAxis(): PidAxis {
  return { p: 40, i: 40, d: 20, ff: 0 };
}

export function emptyPid(): PidProfile {
  return {
    roll: emptyAxis(),
    pitch: emptyAxis(),
    yaw: { p: 45, i: 45, d: 0, ff: 0 },
  };
}

export function emptyRates(): RatesProfile {
  return {
    rcRate: 100,
    rcExpo: 0,
    rollRate: 70,
    pitchRate: 70,
    yawRate: 70,
    tpaRate: 10,
    thrMid: 50,
    thrExpo: 0,
    tpaBreakpoint: 1500,
    rcYawExpo: 0,
    rcYawRate: 100,
    raw: new Uint8Array([
      100, 0, 70, 70, 70, 10, 50, 0, 0xdc, 0x05, 0, 100,
    ]),
  };
}

export function emptyFilters(): FilterConfig {
  return {
    gyroLowpassHz: 100,
    dtermLowpassHz: 100,
    yawLowpassHz: 100,
    gyroNotchHz: 0,
    gyroNotchCutoff: 0,
    dtermNotchHz: 0,
    dtermNotchCutoff: 0,
    raw: new Uint8Array([100, 100, 0, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  };
}

/** Legacy MSP_PID: 3 axes × P,I,D as uint8 (9 bytes). */
export function parseLegacyPid(payload: Uint8Array): PidProfile | null {
  if (payload.length < 9) return null;
  const axis = (o: number): PidAxis => ({
    p: payload[o]!,
    i: payload[o + 1]!,
    d: payload[o + 2]!,
    ff: 0,
  });
  return {
    roll: axis(0),
    pitch: axis(3),
    yaw: axis(6),
  };
}

export function encodeLegacyPid(pid: PidProfile): Uint8Array {
  return new Uint8Array([
    clampU8(pid.roll.p),
    clampU8(pid.roll.i),
    clampU8(pid.roll.d),
    clampU8(pid.pitch.p),
    clampU8(pid.pitch.i),
    clampU8(pid.pitch.d),
    clampU8(pid.yaw.p),
    clampU8(pid.yaw.i),
    clampU8(pid.yaw.d),
  ]);
}

/**
 * MSP_RC_TUNING — common Cleanflight/BF/iNav layout (min 11 bytes).
 * Extra trailing bytes are preserved in `raw` for round-trip.
 */
export function parseRcTuning(payload: Uint8Array): RatesProfile | null {
  if (payload.length < 11) return null;
  return {
    rcRate: payload[0]!,
    rcExpo: payload[1]!,
    rollRate: payload[2]!,
    pitchRate: payload[3]!,
    yawRate: payload[4]!,
    tpaRate: payload[5]!,
    thrMid: payload[6]!,
    thrExpo: payload[7]!,
    tpaBreakpoint: readU16LE(payload, 8),
    rcYawExpo: payload[10]!,
    rcYawRate: payload.length > 11 ? payload[11]! : 100,
    raw: new Uint8Array(payload),
  };
}

export function encodeRcTuning(rates: RatesProfile): Uint8Array {
  const out = new Uint8Array(rates.raw);
  if (out.length < 11) {
    return encodeRcTuning({ ...rates, raw: emptyRates().raw });
  }
  out[0] = clampU8(rates.rcRate);
  out[1] = clampU8(rates.rcExpo);
  out[2] = clampU8(rates.rollRate);
  out[3] = clampU8(rates.pitchRate);
  out[4] = clampU8(rates.yawRate);
  out[5] = clampU8(rates.tpaRate);
  out[6] = clampU8(rates.thrMid);
  out[7] = clampU8(rates.thrExpo);
  writeU16LE(out, 8, rates.tpaBreakpoint);
  out[10] = clampU8(rates.rcYawExpo);
  if (out.length > 11) out[11] = clampU8(rates.rcYawRate);
  return out;
}

/**
 * MSP_FILTER_CONFIG — classic BF layout (min 13 bytes).
 * Newer firmwares append fields; we keep them via `raw`.
 */
export function parseFilterConfig(payload: Uint8Array): FilterConfig | null {
  if (payload.length < 13) return null;
  return {
    gyroLowpassHz: payload[0]!,
    dtermLowpassHz: readU16LE(payload, 1),
    yawLowpassHz: readU16LE(payload, 3),
    gyroNotchHz: readU16LE(payload, 5),
    gyroNotchCutoff: readU16LE(payload, 7),
    dtermNotchHz: readU16LE(payload, 9),
    dtermNotchCutoff: readU16LE(payload, 11),
    raw: new Uint8Array(payload),
  };
}

export function encodeFilterConfig(filter: FilterConfig): Uint8Array {
  const out = new Uint8Array(filter.raw);
  if (out.length < 13) {
    return encodeFilterConfig({ ...filter, raw: emptyFilters().raw });
  }
  out[0] = clampU8(filter.gyroLowpassHz);
  writeU16LE(out, 1, filter.dtermLowpassHz);
  writeU16LE(out, 3, filter.yawLowpassHz);
  writeU16LE(out, 5, filter.gyroNotchHz);
  writeU16LE(out, 7, filter.gyroNotchCutoff);
  writeU16LE(out, 9, filter.dtermNotchHz);
  writeU16LE(out, 11, filter.dtermNotchCutoff);
  return out;
}

export const RATES_FIELDS: {
  key: keyof Omit<RatesProfile, "raw">;
  labelKey: string;
}[] = [
  { key: "rcRate", labelKey: "pid.rates.rcRate" },
  { key: "rcExpo", labelKey: "pid.rates.rcExpo" },
  { key: "rollRate", labelKey: "pid.rates.rollRate" },
  { key: "pitchRate", labelKey: "pid.rates.pitchRate" },
  { key: "yawRate", labelKey: "pid.rates.yawRate" },
  { key: "rcYawRate", labelKey: "pid.rates.rcYawRate" },
  { key: "rcYawExpo", labelKey: "pid.rates.rcYawExpo" },
  { key: "thrMid", labelKey: "pid.rates.thrMid" },
  { key: "thrExpo", labelKey: "pid.rates.thrExpo" },
  { key: "tpaRate", labelKey: "pid.rates.tpaRate" },
  { key: "tpaBreakpoint", labelKey: "pid.rates.tpaBreakpoint" },
];

export const FILTER_FIELDS: {
  key: keyof Omit<FilterConfig, "raw">;
  labelKey: string;
}[] = [
  { key: "gyroLowpassHz", labelKey: "pid.filter.gyroLpf" },
  { key: "dtermLowpassHz", labelKey: "pid.filter.dtermLpf" },
  { key: "yawLowpassHz", labelKey: "pid.filter.yawLpf" },
  { key: "gyroNotchHz", labelKey: "pid.filter.gyroNotch" },
  { key: "gyroNotchCutoff", labelKey: "pid.filter.gyroNotchCutoff" },
  { key: "dtermNotchHz", labelKey: "pid.filter.dtermNotch" },
  { key: "dtermNotchCutoff", labelKey: "pid.filter.dtermNotchCutoff" },
];
