/**
 * Minimal MultiWii Serial Protocol (MSP) v1 / v2 for iNav Status (read-only).
 * Not a full Configurator — no EEPROM write, motors, or calibration.
 *
 * CLI vs MSP: iNav uses MSP when not in CLI. Prefer `exit` before polling if
 * the FC may be stuck in CLI mode.
 */

/** Direction: request to FC / response from FC. */
export type MspDirection = "to_fc" | "from_fc";

export const MSP_API_VERSION = 1;
export const MSP_FC_VARIANT = 2;
export const MSP_FC_VERSION = 3;
export const MSP_NAME = 10;
export const MSP_STATUS = 101;
export const MSP_RAW_GPS = 106;
export const MSP_ANALOG = 110;
export const MSP_STATUS_EX = 150;

export interface MspFrame {
  version: 1 | 2;
  direction: MspDirection;
  cmd: number;
  payload: Uint8Array;
  /** MSP v2 flag byte (0 when v1). */
  flag?: number;
}

export interface MspApiVersion {
  protocolVersion: number;
  apiMajor: number;
  apiMinor: number;
}

export interface MspFcVersion {
  major: number;
  minor: number;
  patch: number;
}

export interface MspStatus {
  cycleTime: number;
  i2cErrorCount: number;
  /** Sensors present bitmask. */
  sensors: number;
  /** Box/mode flags. */
  modeFlags: number;
  currentSet: number;
  /** Present when STATUS_EX (or extended STATUS). */
  cpuLoad?: number;
  armed: boolean;
}

export interface MspAnalog {
  /** Battery voltage in volts. */
  voltage: number;
  mAhDrawn: number;
  rssi: number;
  /** Amperage in amps, or null if unavailable. */
  amperage: number | null;
}

export interface MspRawGps {
  fix: number;
  numSat: number;
  lat: number;
  lon: number;
  /** Altitude meters. */
  alt: number;
  /** Ground speed m/s. */
  speed: number;
  /** Ground course degrees. */
  groundCourse: number;
}

export interface MspStatusSnapshot {
  apiVersion: MspApiVersion | null;
  fcVariant: string | null;
  fcVersion: MspFcVersion | null;
  name: string | null;
  status: MspStatus | null;
  analog: MspAnalog | null;
  gps: MspRawGps | null;
  /** True when fcVariant is exactly INAV (case-insensitive). */
  isInav: boolean;
  updatedAt: number;
}

/** Sensor bit labels (MultiWii / iNav convention). */
export const MSP_SENSOR_BITS: { bit: number; id: string }[] = [
  { bit: 0, id: "acc" },
  { bit: 1, id: "baro" },
  { bit: 2, id: "mag" },
  { bit: 3, id: "gps" },
  { bit: 4, id: "sonar" },
  { bit: 5, id: "gyro" },
  { bit: 6, id: "opticalflow" },
];

export function sensorsPresentLabels(mask: number): string[] {
  return MSP_SENSOR_BITS.filter((s) => (mask & (1 << s.bit)) !== 0).map(
    (s) => s.id,
  );
}

/** GPS fix type short label. */
export function mspGpsFixLabel(fix: number): string {
  if (fix <= 0) return "none";
  if (fix === 1) return "nofix";
  if (fix === 2) return "2d";
  if (fix >= 3) return "3d";
  return String(fix);
}

function xorChecksum(size: number, cmd: number, payload: Uint8Array): number {
  let c = size ^ cmd;
  for (let i = 0; i < payload.length; i++) {
    c ^= payload[i]!;
  }
  return c & 0xff;
}

/** CRC8 DVB-S2 used by MSP v2. */
export function crc8DvbS2(data: Uint8Array | number[]): number {
  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]!;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x80) {
        crc = ((crc << 1) ^ 0xd5) & 0xff;
      } else {
        crc = (crc << 1) & 0xff;
      }
    }
  }
  return crc;
}

export function encodeMspV1(
  cmd: number,
  payload: Uint8Array | number[] = [],
  direction: MspDirection = "to_fc",
): Uint8Array {
  const pl =
    payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  const size = pl.length;
  const dir = direction === "to_fc" ? "<".charCodeAt(0) : ">".charCodeAt(0);
  const out = new Uint8Array(6 + size);
  out[0] = 0x24; // $
  out[1] = 0x4d; // M
  out[2] = dir;
  out[3] = size;
  out[4] = cmd & 0xff;
  out.set(pl, 5);
  out[5 + size] = xorChecksum(size, cmd & 0xff, pl);
  return out;
}

export function encodeMspV2(
  cmd: number,
  payload: Uint8Array | number[] = [],
  direction: MspDirection = "to_fc",
  flag = 0,
): Uint8Array {
  const pl =
    payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  const size = pl.length;
  const dir = direction === "to_fc" ? "<".charCodeAt(0) : ">".charCodeAt(0);
  const out = new Uint8Array(9 + size);
  out[0] = 0x24; // $
  out[1] = 0x58; // X
  out[2] = dir;
  out[3] = flag & 0xff;
  out[4] = cmd & 0xff;
  out[5] = (cmd >> 8) & 0xff;
  out[6] = size & 0xff;
  out[7] = (size >> 8) & 0xff;
  out.set(pl, 8);
  const crcBody = out.subarray(3, 8 + size);
  out[8 + size] = crc8DvbS2(crcBody);
  return out;
}

/** Prefer v1 for classic commands (< 256); v2 when needed. */
export function encodeMspRequest(
  cmd: number,
  payload: Uint8Array | number[] = [],
): Uint8Array {
  if (cmd > 255) {
    return encodeMspV2(cmd, payload);
  }
  return encodeMspV1(cmd, payload);
}

function readU16LE(buf: Uint8Array, off: number): number {
  return (buf[off]! | (buf[off + 1]! << 8)) >>> 0;
}

function readU32LE(buf: Uint8Array, off: number): number {
  return (
    (buf[off]! |
      (buf[off + 1]! << 8) |
      (buf[off + 2]! << 16) |
      (buf[off + 3]! << 24)) >>>
    0
  );
}

function readI32LE(buf: Uint8Array, off: number): number {
  const u = readU32LE(buf, off);
  return u > 0x7fffffff ? u - 0x100000000 : u;
}

export function parseApiVersion(payload: Uint8Array): MspApiVersion | null {
  if (payload.length < 3) return null;
  return {
    protocolVersion: payload[0]!,
    apiMajor: payload[1]!,
    apiMinor: payload[2]!,
  };
}

export function parseFcVariant(payload: Uint8Array): string | null {
  if (payload.length < 1) return null;
  let s = "";
  for (let i = 0; i < Math.min(payload.length, 4); i++) {
    const c = payload[i]!;
    if (c === 0) break;
    if (c >= 32 && c < 127) s += String.fromCharCode(c);
  }
  return s || null;
}

export function parseFcVersion(payload: Uint8Array): MspFcVersion | null {
  if (payload.length < 3) return null;
  return {
    major: payload[0]!,
    minor: payload[1]!,
    patch: payload[2]!,
  };
}

export function parseName(payload: Uint8Array): string | null {
  if (payload.length === 0) return "";
  let s = "";
  for (let i = 0; i < payload.length; i++) {
    const c = payload[i]!;
    if (c === 0) break;
    if (c >= 32 && c < 127) s += String.fromCharCode(c);
  }
  return s;
}

/**
 * Armed flag is typically bit 0 of mode box flags on MultiWii-derived FCs.
 * STATUS_EX / STATUS share the same leading layout.
 */
export function parseStatus(payload: Uint8Array): MspStatus | null {
  if (payload.length < 11) return null;
  const modeFlags = readU32LE(payload, 6);
  const status: MspStatus = {
    cycleTime: readU16LE(payload, 0),
    i2cErrorCount: readU16LE(payload, 2),
    sensors: readU16LE(payload, 4),
    modeFlags,
    currentSet: payload[10]!,
    armed: (modeFlags & 1) !== 0,
  };
  if (payload.length >= 13) {
    status.cpuLoad = readU16LE(payload, 11);
  }
  return status;
}

export function parseAnalog(payload: Uint8Array): MspAnalog | null {
  if (payload.length < 7) return null;
  const vbatRaw = payload[0]!;
  const amperageRaw = readU16LE(payload, 5);
  return {
    // Classic MSP: 0.1 V units; some FCs send 0 when unavailable.
    voltage: vbatRaw / 10,
    mAhDrawn: readU16LE(payload, 1),
    rssi: readU16LE(payload, 3),
    amperage: amperageRaw === 0xffff ? null : amperageRaw / 100,
  };
}

export function parseRawGps(payload: Uint8Array): MspRawGps | null {
  if (payload.length < 16) return null;
  return {
    fix: payload[0]!,
    numSat: payload[1]!,
    lat: readI32LE(payload, 2) / 1e7,
    lon: readI32LE(payload, 6) / 1e7,
    alt: readU16LE(payload, 10),
    speed: readU16LE(payload, 12) / 100,
    groundCourse: readU16LE(payload, 14) / 10,
  };
}

export function emptySnapshot(updatedAt = Date.now()): MspStatusSnapshot {
  return {
    apiVersion: null,
    fcVariant: null,
    fcVersion: null,
    name: null,
    status: null,
    analog: null,
    gps: null,
    isInav: false,
    updatedAt,
  };
}

export function applyMspFrameToSnapshot(
  snap: MspStatusSnapshot,
  frame: MspFrame,
): MspStatusSnapshot {
  const next = { ...snap, updatedAt: Date.now() };
  switch (frame.cmd) {
    case MSP_API_VERSION:
      next.apiVersion = parseApiVersion(frame.payload);
      break;
    case MSP_FC_VARIANT: {
      next.fcVariant = parseFcVariant(frame.payload);
      next.isInav = (next.fcVariant ?? "").toUpperCase() === "INAV";
      break;
    }
    case MSP_FC_VERSION:
      next.fcVersion = parseFcVersion(frame.payload);
      break;
    case MSP_NAME:
      next.name = parseName(frame.payload);
      break;
    case MSP_STATUS:
    case MSP_STATUS_EX:
      next.status = parseStatus(frame.payload);
      break;
    case MSP_ANALOG:
      next.analog = parseAnalog(frame.payload);
      break;
    case MSP_RAW_GPS:
      next.gps = parseRawGps(frame.payload);
      break;
    default:
      break;
  }
  return next;
}

/** Commands polled for the read-only Status card. */
export const MSP_STATUS_POLL_CMDS: number[] = [
  MSP_API_VERSION,
  MSP_FC_VARIANT,
  MSP_FC_VERSION,
  MSP_NAME,
  MSP_STATUS_EX,
  MSP_STATUS,
  MSP_ANALOG,
  MSP_RAW_GPS,
];

/**
 * Streaming MSP frame parser (v1 `$M>` / `$M!` and v2 `$X>` / `$X!`).
 */
export class MspMinimalParser {
  private buf: number[] = [];

  reset(): void {
    this.buf = [];
  }

  push(bytes: Uint8Array | number[]): MspFrame[] {
    for (let i = 0; i < bytes.length; i++) {
      this.buf.push(bytes[i]!);
    }
    const frames: MspFrame[] = [];
    // Cap buffer to avoid unbounded growth on noise.
    if (this.buf.length > 8192) {
      this.buf = this.buf.slice(this.buf.length - 4096);
    }
    while (true) {
      const frame = this.tryExtract();
      if (!frame) break;
      frames.push(frame);
    }
    return frames;
  }

  private tryExtract(): MspFrame | null {
    const buf = this.buf;
    // Seek preamble $
    let start = -1;
    for (let i = 0; i < buf.length - 2; i++) {
      if (buf[i] === 0x24 && (buf[i + 1] === 0x4d || buf[i + 1] === 0x58)) {
        start = i;
        break;
      }
    }
    if (start < 0) {
      // Keep last byte in case next chunk completes `$`.
      if (buf.length > 1) this.buf = buf.slice(-1);
      return null;
    }
    if (start > 0) {
      this.buf = buf.slice(start);
    }
    if (this.buf.length < 3) return null;

    const proto = this.buf[1]!;
    if (proto === 0x4d) {
      return this.tryExtractV1();
    }
    if (proto === 0x58) {
      return this.tryExtractV2();
    }
    this.buf.shift();
    return null;
  }

  private tryExtractV1(): MspFrame | null {
    // $ M dir size cmd payload checksum  => min 6
    if (this.buf.length < 6) return null;
    const dirByte = this.buf[2]!;
    if (dirByte !== 0x3c && dirByte !== 0x3e && dirByte !== 0x21) {
      // < > !
      this.buf.shift();
      return null;
    }
    const size = this.buf[3]!;
    const total = 6 + size;
    if (this.buf.length < total) return null;
    const cmd = this.buf[4]!;
    const payload = new Uint8Array(this.buf.slice(5, 5 + size));
    const checksum = this.buf[5 + size]!;
    const expected = xorChecksum(size, cmd, payload);
    this.buf = this.buf.slice(total);
    if (checksum !== expected) {
      return null;
    }
    return {
      version: 1,
      direction: dirByte === 0x3c ? "to_fc" : "from_fc",
      cmd,
      payload,
    };
  }

  private tryExtractV2(): MspFrame | null {
    // $ X dir flag cmdL cmdH sizeL sizeH payload crc  => min 9
    if (this.buf.length < 9) return null;
    const dirByte = this.buf[2]!;
    if (dirByte !== 0x3c && dirByte !== 0x3e && dirByte !== 0x21) {
      this.buf.shift();
      return null;
    }
    const flag = this.buf[3]!;
    const cmd = this.buf[4]! | (this.buf[5]! << 8);
    const size = this.buf[6]! | (this.buf[7]! << 8);
    if (size > 4096) {
      this.buf.shift();
      return null;
    }
    const total = 9 + size;
    if (this.buf.length < total) return null;
    const payload = new Uint8Array(this.buf.slice(8, 8 + size));
    const crc = this.buf[8 + size]!;
    const crcBody = new Uint8Array(this.buf.slice(3, 8 + size));
    const expected = crc8DvbS2(crcBody);
    this.buf = this.buf.slice(total);
    if (crc !== expected) {
      return null;
    }
    return {
      version: 2,
      direction: dirByte === 0x3c ? "to_fc" : "from_fc",
      cmd,
      payload,
      flag,
    };
  }
}
