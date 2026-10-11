/**
 * Minimal MAVLink v1/v2 framing + HEARTBEAT / PARAM_VALUE decode.
 * Enough for ArduPilot identity, craft type, and parameter tree bootstrap.
 */

export interface MavlinkFrame {
  version: 1 | 2;
  seq: number;
  sysid: number;
  compid: number;
  msgid: number;
  payload: Uint8Array;
}

export interface MavHeartbeat {
  type: number;
  autopilot: number;
  baseMode: number;
  customMode: number;
  systemStatus: number;
  mavlinkVersion: number;
}

export interface MavParamValue {
  paramId: string;
  paramValue: number;
  paramType: number;
  paramCount: number;
  paramIndex: number;
}

export const MAVLINK_MSG_HEARTBEAT = 0;
export const MAVLINK_MSG_PARAM_VALUE = 22;
export const MAVLINK_MSG_PARAM_REQUEST_LIST = 21;
export const MAVLINK_MSG_STATUSTEXT = 253;

/** MAV_TYPE → craft label. */
export function craftFromMavType(type: number): string {
  switch (type) {
    case 1:
      return "Fixed wing";
    case 2:
      return "Quadrotor";
    case 3:
      return "Coaxial";
    case 4:
      return "Helicopter";
    case 10:
      return "Ground rover";
    case 11:
      return "Surface boat";
    case 12:
      return "Submarine";
    case 13:
      return "Hexarotor";
    case 14:
      return "Octorotor";
    case 15:
      return "Tricopter";
    case 19:
      return "VTOL";
    default:
      return `Type ${type}`;
  }
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

function readF32LE(buf: Uint8Array, off: number): number {
  return new DataView(buf.buffer, buf.byteOffset + off, 4).getFloat32(0, true);
}

export function parseHeartbeat(payload: Uint8Array): MavHeartbeat | null {
  if (payload.length < 9) return null;
  return {
    type: payload[4]!,
    autopilot: payload[5]!,
    baseMode: payload[6]!,
    customMode: readU32LE(payload, 0),
    systemStatus: payload[7]!,
    mavlinkVersion: payload[8]!,
  };
}

export function parseParamValue(payload: Uint8Array): MavParamValue | null {
  if (payload.length < 25) return null;
  let paramId = "";
  for (let i = 0; i < 16; i++) {
    const c = payload[4 + i]!;
    if (c === 0) break;
    if (c >= 32 && c < 127) paramId += String.fromCharCode(c);
  }
  return {
    paramValue: readF32LE(payload, 0),
    paramCount: payload[20]! | (payload[21]! << 8),
    paramIndex: payload[22]! | (payload[23]! << 8),
    paramType: payload[24]!,
    paramId,
  };
}

/** Encode MAVLink v1 PARAM_REQUEST_LIST (msgid 21). */
export function encodeParamRequestList(sysid = 1, compid = 1): Uint8Array {
  // Simplified v1 frame without CRC_EXTRA table — many links still accept
  // CRC-less probes poorly; we send a well-formed stub via raw bytes used by
  // GCS commonly. For production, wire full CRC_EXTRA. Here we emit a
  // documented placeholder that ArduPilot SITL often answers when CRC matches.
  // Using a minimal hand-built request with CRC for msgid 21 (CRC_EXTRA=159).
  const payload = new Uint8Array([sysid & 0xff, compid & 0xff]);
  return buildMavlinkV1(21, payload, 255, 190, 159);
}

function x25Crc(data: Uint8Array, crcExtra?: number): number {
  let crc = 0xffff;
  const feed = (b: number) => {
    let tmp = b ^ (crc & 0xff);
    tmp ^= tmp << 4;
    crc =
      ((crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4)) & 0xffff;
  };
  for (let i = 0; i < data.length; i++) feed(data[i]!);
  if (crcExtra != null) feed(crcExtra);
  return crc;
}

function buildMavlinkV1(
  msgid: number,
  payload: Uint8Array,
  sysid: number,
  compid: number,
  crcExtra: number,
  seq = 0,
): Uint8Array {
  const len = payload.length;
  const body = new Uint8Array(5 + len);
  body[0] = len;
  body[1] = seq & 0xff;
  body[2] = sysid & 0xff;
  body[3] = compid & 0xff;
  body[4] = msgid & 0xff;
  body.set(payload, 5);
  const crc = x25Crc(body, crcExtra);
  const out = new Uint8Array(6 + len + 2);
  out[0] = 0xfe;
  out.set(body, 1);
  out[6 + len] = crc & 0xff;
  out[7 + len] = (crc >> 8) & 0xff;
  return out;
}

/**
 * Streaming MAVLink parser (v1 0xFE / v2 0xFD). CRC validated for v1.
 */
export class MavlinkParser {
  private buf: number[] = [];

  push(bytes: Uint8Array | number[]): MavlinkFrame[] {
    for (let i = 0; i < bytes.length; i++) this.buf.push(bytes[i]!);
    if (this.buf.length > 16384) {
      this.buf = this.buf.slice(this.buf.length - 8192);
    }
    const frames: MavlinkFrame[] = [];
    while (true) {
      const f = this.tryExtract();
      if (!f) break;
      frames.push(f);
    }
    return frames;
  }

  private tryExtract(): MavlinkFrame | null {
    const buf = this.buf;
    let start = -1;
    for (let i = 0; i < buf.length; i++) {
      if (buf[i] === 0xfe || buf[i] === 0xfd) {
        start = i;
        break;
      }
    }
    if (start < 0) {
      this.buf = [];
      return null;
    }
    if (start > 0) this.buf = buf.slice(start);
    if (this.buf[0] === 0xfe) return this.extractV1();
    return this.extractV2();
  }

  private extractV1(): MavlinkFrame | null {
    if (this.buf.length < 8) return null;
    const len = this.buf[1]!;
    const total = 8 + len;
    if (this.buf.length < total) return null;
    const body = new Uint8Array(this.buf.slice(1, 6 + len));
    const crc = this.buf[6 + len]! | (this.buf[7 + len]! << 8);
    // Accept frame even if CRC unknown for msgid (soft parse) when matches common set.
    const msgid = this.buf[5]!;
    const extras: Record<number, number> = {
      0: 50,
      21: 159,
      22: 220,
      253: 83,
    };
    if (extras[msgid] != null) {
      const expect = x25Crc(body, extras[msgid]);
      if (expect !== crc) {
        this.buf.shift();
        return null;
      }
    }
    const frame: MavlinkFrame = {
      version: 1,
      seq: this.buf[2]!,
      sysid: this.buf[3]!,
      compid: this.buf[4]!,
      msgid,
      payload: new Uint8Array(this.buf.slice(6, 6 + len)),
    };
    this.buf = this.buf.slice(total);
    return frame;
  }

  private extractV2(): MavlinkFrame | null {
    if (this.buf.length < 12) return null;
    const len = this.buf[1]!;
    const total = 12 + len;
    if (this.buf.length < total) return null;
    const msgid =
      this.buf[7]! | (this.buf[8]! << 8) | (this.buf[9]! << 16);
    const frame: MavlinkFrame = {
      version: 2,
      seq: this.buf[4]!,
      sysid: this.buf[5]!,
      compid: this.buf[6]!,
      msgid,
      payload: new Uint8Array(this.buf.slice(10, 10 + len)),
    };
    this.buf = this.buf.slice(total);
    return frame;
  }
}
