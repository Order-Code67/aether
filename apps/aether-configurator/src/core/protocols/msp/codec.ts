/**
 * MSP v1 / v2 encode & decode helpers (Betaflight / iNav compatible).
 */

import {
  MSP_ANALOG,
  MSP_API_VERSION,
  MSP_FC_VARIANT,
  MSP_FC_VERSION,
  MSP_NAME,
  MSP_RAW_GPS,
  MSP_STATUS,
  MSP_STATUS_EX,
} from "./commands";

export type MspDirection = "to_fc" | "from_fc";

export interface MspFrame {
  version: 1 | 2;
  direction: MspDirection;
  cmd: number;
  payload: Uint8Array;
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
  sensors: number;
  modeFlags: number;
  currentSet: number;
  cpuLoad?: number;
  armed: boolean;
}

export interface MspAnalog {
  voltage: number;
  mAhDrawn: number;
  rssi: number;
  amperage: number | null;
}

export interface MspRawGps {
  fix: number;
  numSat: number;
  lat: number;
  lon: number;
  alt: number;
  speed: number;
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
  isInav: boolean;
  isBetaflight: boolean;
  updatedAt: number;
}

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

export function mspGpsFixLabel(fix: number): string {
  if (fix <= 0) return "none";
  if (fix === 1) return "nofix";
  if (fix === 2) return "2d";
  if (fix >= 3) return "3d";
  return String(fix);
}

function xorChecksum(size: number, cmd: number, payload: Uint8Array): number {
  let c = size ^ cmd;
  for (let i = 0; i < payload.length; i++) c ^= payload[i]!;
  return c & 0xff;
}

export function crc8DvbS2(data: Uint8Array | number[]): number {
  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]!;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x80 ? ((crc << 1) ^ 0xd5) & 0xff : (crc << 1) & 0xff;
    }
  }
  return crc;
}

export function encodeMspV1(
  cmd: number,
  payload: Uint8Array | number[] = [],
  direction: MspDirection = "to_fc",
): Uint8Array {
  const pl = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  const size = pl.length;
  const dir = direction === "to_fc" ? 0x3c : 0x3e;
  const out = new Uint8Array(6 + size);
  out[0] = 0x24;
  out[1] = 0x4d;
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
  const pl = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  const size = pl.length;
  const dir = direction === "to_fc" ? 0x3c : 0x3e;
  const out = new Uint8Array(9 + size);
  out[0] = 0x24;
  out[1] = 0x58;
  out[2] = dir;
  out[3] = flag & 0xff;
  out[4] = cmd & 0xff;
  out[5] = (cmd >> 8) & 0xff;
  out[6] = size & 0xff;
  out[7] = (size >> 8) & 0xff;
  out.set(pl, 8);
  out[8 + size] = crc8DvbS2(out.subarray(3, 8 + size));
  return out;
}

export function encodeMspRequest(
  cmd: number,
  payload: Uint8Array | number[] = [],
): Uint8Array {
  return cmd > 255 ? encodeMspV2(cmd, payload) : encodeMspV1(cmd, payload);
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
  return { major: payload[0]!, minor: payload[1]!, patch: payload[2]! };
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
  if (payload.length >= 13) status.cpuLoad = readU16LE(payload, 11);
  return status;
}

export function parseAnalog(payload: Uint8Array): MspAnalog | null {
  if (payload.length < 7) return null;
  const amperageRaw = readU16LE(payload, 5);
  return {
    voltage: payload[0]! / 10,
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
    isBetaflight: false,
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
      const v = (next.fcVariant ?? "").toUpperCase();
      next.isInav = v === "INAV";
      next.isBetaflight = v === "BTFL" || v === "BF";
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

/** Exported for the streaming parser checksum validation. */
export { xorChecksum };
