/**
 * PID / rates / RX / features / mixer / failsafe / battery helpers.
 * MSP where stable; CLI `set` parsing for modern iNav (preferred).
 * Never arms or spins motors.
 */

import {
  cliParamsToMap,
  getMapNumber,
  getMapString,
  parseCliParams,
  type FcCliParam,
} from "@/lib/fcCliParams";
import { encodeMspRequest } from "@/lib/mspMinimal";

export const MSP_BATTERY_CONFIG = 32;
export const MSP_SET_BATTERY_CONFIG = 33;
export const MSP_FEATURE_CONFIG = 36;
export const MSP_SET_FEATURE_CONFIG = 37;
export const MSP_MIXER_CONFIG = 42;
export const MSP_SET_MIXER_CONFIG = 43;
export const MSP_RX_CONFIG = 44;
export const MSP_FAILSAFE_CONFIG = 75;
export const MSP_SET_FAILSAFE_CONFIG = 76;
export const MSP_RC = 105;
export const MSP_ATTITUDE = 108;
export const MSP_RC_TUNING = 111;
export const MSP_PID = 112;
export const MSP_SET_PID = 202;
export const MSP_SET_RC_TUNING = 204;

export type AxisId = "roll" | "pitch" | "yaw";

export interface PidAxis {
  p: number;
  i: number;
  d: number;
  ff: number;
}

export interface PidProfile {
  /** Multirotor (mc_*) or fixed-wing (fw_*). */
  family: "mc" | "fw";
  roll: PidAxis;
  pitch: PidAxis;
  yaw: PidAxis;
}

export interface RatesProfile {
  rollRate: number;
  pitchRate: number;
  yawRate: number;
  rcExpo: number;
  rcYawExpo: number;
  thrMid: number;
  thrExpo: number;
  tpaRate: number;
  tpaBreakpoint: number;
}

export interface BatteryConfig {
  vbatMinCell: number;
  vbatMaxCell: number;
  vbatWarningCell: number;
  capacity: number;
  voltageScale: number;
  currentScale: number;
}

export interface FailsafeConfig {
  procedure: string;
  delayMs: number;
  throttle: number;
}

export interface MixerInfo {
  mixer: string;
  platformType?: string;
}

export interface FeatureFlag {
  id: string;
  enabled: boolean;
}

export interface RcChannels {
  channels: number[];
  updatedAt: number;
}

export interface AttitudeSnapshot {
  /** Degrees. */
  roll: number;
  pitch: number;
  yaw: number;
}

export interface TuningSnapshot {
  params: FcCliParam[];
  pid: PidProfile | null;
  rates: RatesProfile | null;
  battery: BatteryConfig | null;
  failsafe: FailsafeConfig | null;
  mixer: MixerInfo | null;
  features: FeatureFlag[];
  source: "cli" | "msp" | "mixed";
}

function readU16LE(buf: Uint8Array, off: number): number {
  return (buf[off]! | (buf[off + 1]! << 8)) >>> 0;
}

function readI16LE(buf: Uint8Array, off: number): number {
  const u = readU16LE(buf, off);
  return u > 0x7fff ? u - 0x10000 : u;
}

/** MSP_RC: N × uint16 PWM. */
export function parseRcChannels(payload: Uint8Array): RcChannels | null {
  if (payload.length < 2) return null;
  const count = Math.floor(payload.length / 2);
  const channels: number[] = [];
  for (let i = 0; i < count; i++) {
    channels.push(readU16LE(payload, i * 2));
  }
  return { channels, updatedAt: Date.now() };
}

/** MSP_ATTITUDE: roll/pitch int16 (0.1°), yaw uint16. */
export function parseAttitude(payload: Uint8Array): AttitudeSnapshot | null {
  if (payload.length < 6) return null;
  return {
    roll: readI16LE(payload, 0) / 10,
    pitch: readI16LE(payload, 2) / 10,
    yaw: readU16LE(payload, 4),
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
    family: "mc",
    roll: axis(0),
    pitch: axis(3),
    yaw: axis(6),
  };
}

export function encodeLegacyPid(pid: PidProfile): Uint8Array {
  return new Uint8Array([
    pid.roll.p,
    pid.roll.i,
    pid.roll.d,
    pid.pitch.p,
    pid.pitch.i,
    pid.pitch.d,
    pid.yaw.p,
    pid.yaw.i,
    pid.yaw.d,
  ]);
}

/** MSP_FEATURE_CONFIG: uint32 feature mask. */
export function parseFeatureMask(payload: Uint8Array): number | null {
  if (payload.length < 4) return null;
  return (
    (payload[0]! |
      (payload[1]! << 8) |
      (payload[2]! << 16) |
      (payload[3]! << 24)) >>>
    0
  );
}

/** Common Cleanflight/BF/iNav feature bits (subset for UI). */
export const FEATURE_BITS: { bit: number; id: string }[] = [
  { bit: 2, id: "RX_PPM" },
  { bit: 3, id: "MOTOR_STOP" },
  { bit: 4, id: "SERVO_TILT" },
  { bit: 5, id: "SOFTSERIAL" },
  { bit: 6, id: "GPS" },
  { bit: 7, id: "TELEMETRY" },
  { bit: 10, id: "SONAR" },
  { bit: 11, id: "TELEMETRY_IBUS" },
  { bit: 12, id: "AIRMODE" },
  { bit: 15, id: "OSD" },
  { bit: 16, id: "BLACKBOX" },
];

export function featureFlagsFromMask(mask: number): FeatureFlag[] {
  return FEATURE_BITS.map((f) => ({
    id: f.id,
    enabled: (mask & (1 << f.bit)) !== 0,
  }));
}

function emptyAxis(): PidAxis {
  return { p: 0, i: 0, d: 0, ff: 0 };
}

function readAxis(
  map: Map<string, string>,
  family: "mc" | "fw",
  axis: AxisId,
): PidAxis {
  const prefix = `${family}`;
  return {
    p: getMapNumber(map, `${prefix}_p_${axis}`) ?? 0,
    i: getMapNumber(map, `${prefix}_i_${axis}`) ?? 0,
    d: getMapNumber(map, `${prefix}_d_${axis}`) ?? 0,
    ff: getMapNumber(map, `${prefix}_ff_${axis}`) ?? 0,
  };
}

/** Detect mc_* vs fw_* PID family from CLI params. */
export function pidFromCliParams(params: FcCliParam[]): PidProfile | null {
  const map = cliParamsToMap(params);
  const hasMc = [...map.keys()].some((k) => k.startsWith("mc_p_"));
  const hasFw = [...map.keys()].some((k) => k.startsWith("fw_p_"));
  if (!hasMc && !hasFw) return null;
  const family: "mc" | "fw" = hasMc ? "mc" : "fw";
  return {
    family,
    roll: readAxis(map, family, "roll"),
    pitch: readAxis(map, family, "pitch"),
    yaw: readAxis(map, family, "yaw"),
  };
}

export function ratesFromCliParams(params: FcCliParam[]): RatesProfile | null {
  const map = cliParamsToMap(params);
  const rollRate =
    getMapNumber(map, "roll_rate") ??
    getMapNumber(map, "rate_roll") ??
    getMapNumber(map, "rc_rate");
  const pitchRate =
    getMapNumber(map, "pitch_rate") ??
    getMapNumber(map, "rate_pitch") ??
    rollRate;
  const yawRate =
    getMapNumber(map, "yaw_rate") ??
    getMapNumber(map, "rate_yaw") ??
    getMapNumber(map, "rc_yaw_rate");
  if (rollRate == null && pitchRate == null && yawRate == null) return null;
  return {
    rollRate: rollRate ?? 0,
    pitchRate: pitchRate ?? 0,
    yawRate: yawRate ?? 0,
    rcExpo: getMapNumber(map, "rc_expo") ?? getMapNumber(map, "rc_expo_roll") ?? 0,
    rcYawExpo: getMapNumber(map, "rc_yaw_expo") ?? getMapNumber(map, "rc_expo_yaw") ?? 0,
    thrMid: getMapNumber(map, "thr_mid") ?? 50,
    thrExpo: getMapNumber(map, "thr_expo") ?? 0,
    tpaRate: getMapNumber(map, "tpa_rate") ?? 0,
    tpaBreakpoint: getMapNumber(map, "tpa_breakpoint") ?? 1500,
  };
}

export function batteryFromCliParams(params: FcCliParam[]): BatteryConfig | null {
  const map = cliParamsToMap(params);
  const capacity = getMapNumber(map, "battery_capacity");
  const vbatMin = getMapNumber(map, "vbat_cell_detect_voltage") ??
    getMapNumber(map, "vbat_min_cell_voltage");
  const vbatMax =
    getMapNumber(map, "vbat_max_cell_voltage") ??
    getMapNumber(map, "vbat_maxcellvoltage");
  const vbatWarn =
    getMapNumber(map, "vbat_warning_cell_voltage") ??
    getMapNumber(map, "vbat_warning_cellvoltage");
  if (
    capacity == null &&
    vbatMin == null &&
    vbatMax == null &&
    vbatWarn == null
  ) {
    return null;
  }
  return {
    vbatMinCell: vbatMin ?? 330,
    vbatMaxCell: vbatMax ?? 430,
    vbatWarningCell: vbatWarn ?? 350,
    capacity: capacity ?? 0,
    voltageScale: getMapNumber(map, "vbat_scale") ?? 1100,
    currentScale: getMapNumber(map, "current_meter_scale") ?? 400,
  };
}

export function failsafeFromCliParams(
  params: FcCliParam[],
): FailsafeConfig | null {
  const map = cliParamsToMap(params);
  const procedure = getMapString(map, "failsafe_procedure");
  if (!procedure) return null;
  return {
    procedure: procedure.toUpperCase(),
    delayMs: getMapNumber(map, "failsafe_delay") ?? 5,
    throttle: getMapNumber(map, "failsafe_throttle") ?? 1000,
  };
}

export function mixerFromCliParams(params: FcCliParam[]): MixerInfo | null {
  const map = cliParamsToMap(params);
  const mixer = getMapString(map, "mixer");
  const platform = getMapString(map, "platform_type");
  if (!mixer && !platform) return null;
  return {
    mixer: (mixer ?? "UNKNOWN").toUpperCase(),
    platformType: platform?.toUpperCase(),
  };
}

export function featuresFromCliParams(params: FcCliParam[]): FeatureFlag[] {
  return params
    .filter((p) => p.kind === "feature")
    .map((p) => ({
      id: p.name.toUpperCase(),
      enabled: p.value.toUpperCase() !== "OFF",
    }));
}

/** Build a full tuning snapshot from CLI dump/diff text. */
export function tuningFromCliText(text: string): TuningSnapshot {
  const params = parseCliParams(text);
  return {
    params,
    pid: pidFromCliParams(params),
    rates: ratesFromCliParams(params),
    battery: batteryFromCliParams(params),
    failsafe: failsafeFromCliParams(params),
    mixer: mixerFromCliParams(params),
    features: featuresFromCliParams(params),
    source: "cli",
  };
}

/** CLI lines to apply a PID profile (RAM until save). */
export function formatPidCliLines(pid: PidProfile): string[] {
  const f = pid.family;
  const axes: AxisId[] = ["roll", "pitch", "yaw"];
  const lines: string[] = [];
  for (const a of axes) {
    const ax = pid[a];
    lines.push(`set ${f}_p_${a} = ${ax.p}`);
    lines.push(`set ${f}_i_${a} = ${ax.i}`);
    lines.push(`set ${f}_d_${a} = ${ax.d}`);
    lines.push(`set ${f}_ff_${a} = ${ax.ff}`);
  }
  return lines;
}

export function formatRatesCliLines(rates: RatesProfile): string[] {
  return [
    `set roll_rate = ${rates.rollRate}`,
    `set pitch_rate = ${rates.pitchRate}`,
    `set yaw_rate = ${rates.yawRate}`,
    `set rc_expo = ${rates.rcExpo}`,
    `set rc_yaw_expo = ${rates.rcYawExpo}`,
    `set thr_mid = ${rates.thrMid}`,
    `set thr_expo = ${rates.thrExpo}`,
    `set tpa_rate = ${rates.tpaRate}`,
    `set tpa_breakpoint = ${rates.tpaBreakpoint}`,
  ];
}

export function formatBatteryCliLines(bat: BatteryConfig): string[] {
  return [
    `set vbat_min_cell_voltage = ${bat.vbatMinCell}`,
    `set vbat_max_cell_voltage = ${bat.vbatMaxCell}`,
    `set vbat_warning_cell_voltage = ${bat.vbatWarningCell}`,
    `set battery_capacity = ${bat.capacity}`,
    `set vbat_scale = ${bat.voltageScale}`,
    `set current_meter_scale = ${bat.currentScale}`,
  ];
}

export function formatFailsafeCliLines(fs: FailsafeConfig): string[] {
  return [
    `set failsafe_procedure = ${fs.procedure}`,
    `set failsafe_delay = ${fs.delayMs}`,
    `set failsafe_throttle = ${fs.throttle}`,
  ];
}

export function formatMixerCliLines(mixer: MixerInfo): string[] {
  const lines = [`mixer ${mixer.mixer}`];
  if (mixer.platformType) {
    lines.push(`set platform_type = ${mixer.platformType}`);
  }
  return lines;
}

export function encodeRcRequest(): Uint8Array {
  return encodeMspRequest(MSP_RC);
}

export function encodeAttitudeRequest(): Uint8Array {
  return encodeMspRequest(MSP_ATTITUDE);
}

export function emptyPid(family: "mc" | "fw" = "mc"): PidProfile {
  return {
    family,
    roll: emptyAxis(),
    pitch: emptyAxis(),
    yaw: emptyAxis(),
  };
}

/** Channel display labels (BF/iNav convention). */
export const RC_CHANNEL_LABELS = [
  "Roll",
  "Pitch",
  "Yaw",
  "Throttle",
  "AUX1",
  "AUX2",
  "AUX3",
  "AUX4",
  "AUX5",
  "AUX6",
  "AUX7",
  "AUX8",
  "AUX9",
  "AUX10",
  "AUX11",
  "AUX12",
] as const;

export const FAILSAFE_PROCEDURES = [
  "DROP",
  "LAND",
  "RTH",
  "NONE",
  "SET",
] as const;

export const MIXER_TYPES = [
  "QUADX",
  "QUADX1234",
  "TRI",
  "HEX6X",
  "Y4",
  "AIRPLANE",
  "FLYING_WING",
  "VTAIL4",
  "ATAIL4",
  "CUSTOM",
] as const;

export const PLATFORM_TYPES = [
  "MULTIROTOR",
  "AIRPLANE",
  "HELICOPTER",
  "TRICOPTER",
  "ROVER",
  "BOAT",
] as const;
