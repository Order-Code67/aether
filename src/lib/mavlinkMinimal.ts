/**
 * Minimal MAVLink v1/v2 parser: HEARTBEAT (0), SYS_STATUS (1), ATTITUDE (30).
 * No full dialect / QGC — enough for Plotter Telemetry mode.
 */

export const MAVLINK_MSG_HEARTBEAT = 0;
export const MAVLINK_MSG_SYS_STATUS = 1;
export const MAVLINK_MSG_ATTITUDE = 30;

/** CRC_EXTRA per msgid (common.xml). */
const CRC_EXTRA: Record<number, number> = {
  [MAVLINK_MSG_HEARTBEAT]: 50,
  [MAVLINK_MSG_SYS_STATUS]: 124,
  [MAVLINK_MSG_ATTITUDE]: 39,
};

const STX_V1 = 0xfe;
const STX_V2 = 0xfd;

export type MavlinkVehicleType =
  | "generic"
  | "fixed_wing"
  | "quadrotor"
  | "coaxial"
  | "helicopter"
  | "antenna_tracker"
  | "gcs"
  | "airship"
  | "free_balloon"
  | "rocket"
  | "ground_rover"
  | "surface_boat"
  | "submarine"
  | "hexarotor"
  | "octorotor"
  | "tricopter"
  | "other";

export interface MavlinkHeartbeat {
  type: number;
  vehicleType: MavlinkVehicleType;
  autopilot: number;
  baseMode: number;
  customMode: number;
  systemStatus: number;
  mavlinkVersion: number;
  armed: boolean;
}

export interface MavlinkAttitude {
  roll: number;
  pitch: number;
  yaw: number;
  rollspeed: number;
  pitchspeed: number;
  yawspeed: number;
}

export interface MavlinkSysStatus {
  /** Battery voltage in volts (from mV). */
  voltage: number;
  /** Battery current in amps (from cA), or null if unknown (-1). */
  current: number | null;
  /** Remaining % or null if unknown (-1). */
  batteryRemaining: number | null;
}

export interface MavlinkFrame {
  version: 1 | 2;
  msgid: number;
  sysid: number;
  compid: number;
  payload: Uint8Array;
}

export type MavlinkParseResult =
  | { kind: "heartbeat"; frame: MavlinkFrame; data: MavlinkHeartbeat }
  | { kind: "attitude"; frame: MavlinkFrame; data: MavlinkAttitude }
  | { kind: "sys_status"; frame: MavlinkFrame; data: MavlinkSysStatus }
  | { kind: "other"; frame: MavlinkFrame };

const VEHICLE_TYPES: Record<number, MavlinkVehicleType> = {
  0: "generic",
  1: "fixed_wing",
  2: "quadrotor",
  3: "coaxial",
  4: "helicopter",
  5: "antenna_tracker",
  6: "gcs",
  7: "airship",
  8: "free_balloon",
  9: "rocket",
  10: "ground_rover",
  11: "surface_boat",
  12: "submarine",
  13: "hexarotor",
  14: "octorotor",
  15: "tricopter",
};

function mapVehicleType(type: number): MavlinkVehicleType {
  return VEHICLE_TYPES[type] ?? "other";
}

function x25CrcAccumulate(data: number, crcAccum: number): number {
  let tmp = data ^ (crcAccum & 0xff);
  tmp = (tmp ^ (tmp << 4)) & 0xff;
  return (
    ((crcAccum >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4)) & 0xffff
  );
}

function x25Crc(bytes: ArrayLike<number>, crcExtra?: number): number {
  let crc = 0xffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = x25CrcAccumulate(bytes[i]!, crc);
  }
  if (crcExtra !== undefined) {
    crc = x25CrcAccumulate(crcExtra, crc);
  }
  return crc;
}

function readU16LE(buf: Uint8Array, off: number): number {
  return buf[off]! | (buf[off + 1]! << 8);
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

function readI16LE(buf: Uint8Array, off: number): number {
  const v = readU16LE(buf, off);
  return v > 0x7fff ? v - 0x10000 : v;
}

function readF32LE(buf: Uint8Array, off: number): number {
  const view = new DataView(buf.buffer, buf.byteOffset + off, 4);
  return view.getFloat32(0, true);
}

function decodeHeartbeat(payload: Uint8Array): MavlinkHeartbeat | null {
  if (payload.length < 9) return null;
  const customMode = readU32LE(payload, 0);
  const type = payload[4]!;
  const autopilot = payload[5]!;
  const baseMode = payload[6]!;
  const systemStatus = payload[7]!;
  const mavlinkVersion = payload[8]!;
  return {
    type,
    vehicleType: mapVehicleType(type),
    autopilot,
    baseMode,
    customMode,
    systemStatus,
    mavlinkVersion,
    armed: (baseMode & 0x80) !== 0,
  };
}

function decodeAttitude(payload: Uint8Array): MavlinkAttitude | null {
  if (payload.length < 28) return null;
  return {
    roll: readF32LE(payload, 4),
    pitch: readF32LE(payload, 8),
    yaw: readF32LE(payload, 12),
    rollspeed: readF32LE(payload, 16),
    pitchspeed: readF32LE(payload, 20),
    yawspeed: readF32LE(payload, 24),
  };
}

function decodeSysStatus(payload: Uint8Array): MavlinkSysStatus | null {
  if (payload.length < 22) return null;
  const voltageMv = readU16LE(payload, 14);
  const currentCA = readI16LE(payload, 16);
  const batteryRemaining = payload[18]!;
  // Signed int8 for remaining (-1 unknown)
  const rem =
    batteryRemaining > 127 ? batteryRemaining - 256 : batteryRemaining;
  return {
    voltage: voltageMv / 1000,
    current: currentCA < 0 ? null : currentCA / 100,
    batteryRemaining: rem < 0 ? null : rem,
  };
}

function decodeKnown(frame: MavlinkFrame): MavlinkParseResult {
  if (frame.msgid === MAVLINK_MSG_HEARTBEAT) {
    const data = decodeHeartbeat(frame.payload);
    if (data) return { kind: "heartbeat", frame, data };
  }
  if (frame.msgid === MAVLINK_MSG_ATTITUDE) {
    const data = decodeAttitude(frame.payload);
    if (data) return { kind: "attitude", frame, data };
  }
  if (frame.msgid === MAVLINK_MSG_SYS_STATUS) {
    const data = decodeSysStatus(frame.payload);
    if (data) return { kind: "sys_status", frame, data };
  }
  return { kind: "other", frame };
}

/**
 * Streaming byte buffer that extracts MAVLink v1/v2 frames for known messages.
 */
export class MavlinkMinimalParser {
  private buf: number[] = [];
  private static readonly MAX_BUF = 8192;

  reset(): void {
    this.buf = [];
  }

  push(bytes: ArrayLike<number>): MavlinkParseResult[] {
    for (let i = 0; i < bytes.length; i++) {
      this.buf.push(bytes[i]! & 0xff);
    }
    if (this.buf.length > MavlinkMinimalParser.MAX_BUF) {
      this.buf = this.buf.slice(-MavlinkMinimalParser.MAX_BUF);
    }
    const out: MavlinkParseResult[] = [];
    while (true) {
      const frame = this.tryExtract();
      if (!frame) break;
      out.push(decodeKnown(frame));
    }
    return out;
  }

  private tryExtract(): MavlinkFrame | null {
    // Find STX
    let start = -1;
    for (let i = 0; i < this.buf.length; i++) {
      const b = this.buf[i]!;
      if (b === STX_V1 || b === STX_V2) {
        start = i;
        break;
      }
    }
    if (start < 0) {
      this.buf = [];
      return null;
    }
    if (start > 0) {
      this.buf = this.buf.slice(start);
    }

    const stx = this.buf[0]!;
    if (stx === STX_V1) {
      return this.tryExtractV1();
    }
    return this.tryExtractV2();
  }

  /** If a later STX already forms a complete valid known frame, jump to it. */
  private skipFalseStartIfLaterFrameReady(): boolean {
    for (let i = 1; i < this.buf.length; i++) {
      const b = this.buf[i]!;
      if (b !== STX_V1 && b !== STX_V2) continue;
      const slice = this.buf.slice(i);
      const peeked = peekCompleteKnownFrame(slice);
      if (peeked) {
        this.buf = slice;
        return true;
      }
    }
    return false;
  }

  private tryExtractV1(): MavlinkFrame | null {
    // FE | len | seq | sysid | compid | msgid | payload | crc_lo | crc_hi
    if (this.buf.length < 8) return null;
    const len = this.buf[1]!;
    const total = 6 + len + 2;
    if (this.buf.length < total) {
      if (this.skipFalseStartIfLaterFrameReady()) {
        return this.tryExtract();
      }
      return null;
    }

    const msgid = this.buf[5]!;
    const crcExtra = CRC_EXTRA[msgid];
    const crcBytes = this.buf.slice(1, 6 + len);
    const expected = x25Crc(crcBytes, crcExtra);
    const got = this.buf[6 + len]! | (this.buf[7 + len]! << 8);

    if (crcExtra === undefined || got !== expected) {
      // Skip this STX and resync
      this.buf.shift();
      return this.tryExtract();
    }

    const payload = new Uint8Array(this.buf.slice(6, 6 + len));
    const frame: MavlinkFrame = {
      version: 1,
      msgid,
      sysid: this.buf[3]!,
      compid: this.buf[4]!,
      payload,
    };
    this.buf = this.buf.slice(total);
    return frame;
  }

  private tryExtractV2(): MavlinkFrame | null {
    // FD | len | incompat | compat | seq | sysid | compid | msgid0..2 | payload | crc | [sig]
    if (this.buf.length < 12) return null;
    const len = this.buf[1]!;
    const incompat = this.buf[2]!;
    const signed = (incompat & 0x01) !== 0;
    const total = 10 + len + 2 + (signed ? 13 : 0);
    if (this.buf.length < total) {
      if (this.skipFalseStartIfLaterFrameReady()) {
        return this.tryExtract();
      }
      return null;
    }

    const msgid =
      this.buf[7]! | (this.buf[8]! << 8) | (this.buf[9]! << 16);
    const crcExtra = CRC_EXTRA[msgid];
    const crcBytes = this.buf.slice(1, 10 + len);
    const expected = x25Crc(crcBytes, crcExtra);
    const got = this.buf[10 + len]! | (this.buf[11 + len]! << 8);

    if (crcExtra === undefined || got !== expected) {
      this.buf.shift();
      return this.tryExtract();
    }

    const payload = new Uint8Array(this.buf.slice(10, 10 + len));
    const frame: MavlinkFrame = {
      version: 2,
      msgid,
      sysid: this.buf[5]!,
      compid: this.buf[6]!,
      payload,
    };
    this.buf = this.buf.slice(total);
    return frame;
  }
}

/** Non-mutating check: does `buf` start with a complete CRC-valid known message? */
function peekCompleteKnownFrame(buf: number[]): boolean {
  if (buf.length < 8) return false;
  const stx = buf[0]!;
  if (stx === STX_V1) {
    const len = buf[1]!;
    const total = 6 + len + 2;
    if (buf.length < total) return false;
    const msgid = buf[5]!;
    const crcExtra = CRC_EXTRA[msgid];
    if (crcExtra === undefined) return false;
    const expected = x25Crc(buf.slice(1, 6 + len), crcExtra);
    const got = buf[6 + len]! | (buf[7 + len]! << 8);
    return got === expected;
  }
  if (stx === STX_V2) {
    if (buf.length < 12) return false;
    const len = buf[1]!;
    const incompat = buf[2]!;
    const signed = (incompat & 0x01) !== 0;
    const total = 10 + len + 2 + (signed ? 13 : 0);
    if (buf.length < total) return false;
    const msgid = buf[7]! | (buf[8]! << 8) | (buf[9]! << 16);
    const crcExtra = CRC_EXTRA[msgid];
    if (crcExtra === undefined) return false;
    const expected = x25Crc(buf.slice(1, 10 + len), crcExtra);
    const got = buf[10 + len]! | (buf[11 + len]! << 8);
    return got === expected;
  }
  return false;
}

/** Plot channels from a parse result (radians → degrees for attitude). */
export function mavlinkToPlotSample(
  result: MavlinkParseResult,
): Record<string, number> | null {
  if (result.kind === "attitude") {
    const rad2deg = 180 / Math.PI;
    return {
      roll: result.data.roll * rad2deg,
      pitch: result.data.pitch * rad2deg,
      yaw: result.data.yaw * rad2deg,
    };
  }
  if (result.kind === "sys_status") {
    const sample: Record<string, number> = {
      voltage: result.data.voltage,
    };
    if (result.data.current != null) sample.current = result.data.current;
    if (result.data.batteryRemaining != null) {
      sample.battery = result.data.batteryRemaining;
    }
    return sample;
  }
  return null;
}

/** Build a valid v1 HEARTBEAT frame for tests. */
export function buildMavlinkV1Frame(
  msgid: number,
  sysid: number,
  compid: number,
  payload: number[],
  seq = 0,
): Uint8Array {
  const len = payload.length;
  const header = [STX_V1, len, seq & 0xff, sysid & 0xff, compid & 0xff, msgid & 0xff];
  const body = [...header.slice(1), ...payload];
  const crc = x25Crc(body, CRC_EXTRA[msgid]);
  return new Uint8Array([...header, ...payload, crc & 0xff, (crc >> 8) & 0xff]);
}

/** Build a valid v2 frame for tests. */
export function buildMavlinkV2Frame(
  msgid: number,
  sysid: number,
  compid: number,
  payload: number[],
  seq = 0,
): Uint8Array {
  const len = payload.length;
  const msgidBytes = [msgid & 0xff, (msgid >> 8) & 0xff, (msgid >> 16) & 0xff];
  const header = [
    STX_V2,
    len,
    0, // incompat
    0, // compat
    seq & 0xff,
    sysid & 0xff,
    compid & 0xff,
    ...msgidBytes,
  ];
  const body = [...header.slice(1), ...payload];
  const crc = x25Crc(body, CRC_EXTRA[msgid]);
  return new Uint8Array([...header, ...payload, crc & 0xff, (crc >> 8) & 0xff]);
}

export function encodeHeartbeatPayload(opts: {
  type?: number;
  autopilot?: number;
  baseMode?: number;
  customMode?: number;
  systemStatus?: number;
  mavlinkVersion?: number;
}): number[] {
  const custom = opts.customMode ?? 0;
  return [
    custom & 0xff,
    (custom >> 8) & 0xff,
    (custom >> 16) & 0xff,
    (custom >> 24) & 0xff,
    opts.type ?? 2,
    opts.autopilot ?? 3,
    opts.baseMode ?? 0x80,
    opts.systemStatus ?? 4,
    opts.mavlinkVersion ?? 3,
  ];
}

export function encodeAttitudePayload(opts: {
  roll: number;
  pitch: number;
  yaw: number;
}): number[] {
  const buf = new ArrayBuffer(28);
  const view = new DataView(buf);
  view.setUint32(0, 0, true);
  view.setFloat32(4, opts.roll, true);
  view.setFloat32(8, opts.pitch, true);
  view.setFloat32(12, opts.yaw, true);
  view.setFloat32(16, 0, true);
  view.setFloat32(20, 0, true);
  view.setFloat32(24, 0, true);
  return Array.from(new Uint8Array(buf));
}
