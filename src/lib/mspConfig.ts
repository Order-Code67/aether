/**
 * iNav / Cleanflight MSP helpers for Ports (serial) and Modes (box ranges).
 *
 * Notes (iNav):
 * - MSP_CF_SERIAL_CONFIG (54) / MSP_SET_CF_SERIAL_CONFIG (55) are **deprecated
 *   and unused** on modern iNav — prefer CLI `serial` read/write (see
 *   docs/INAV_MSP.md). We still probe MSP best-effort for older/compat FCs.
 * - MSP_MODE_RANGES (34) / MSP_SET_MODE_RANGE (35) / MSP_BOXNAMES (116) /
 *   MSP_BOXIDS (119) / MSP_EEPROM_WRITE (250) are supported.
 * - Never arm or spin motors from this module.
 */

import { encodeMspRequest, encodeMspV1 } from "@/lib/mspMinimal";

export const MSP_MODE_RANGES = 34;
export const MSP_SET_MODE_RANGE = 35;
/** Deprecated on iNav — best-effort only. */
export const MSP_CF_SERIAL_CONFIG = 54;
/** Deprecated on iNav — best-effort only. */
export const MSP_SET_CF_SERIAL_CONFIG = 55;
export const MSP_BOXNAMES = 116;
export const MSP_BOXIDS = 119;
export const MSP_EEPROM_WRITE = 250;

export type SerialPortIdentifier =
  | "USB_VCP"
  | "UART1"
  | "UART2"
  | "UART3"
  | "UART4"
  | "UART5"
  | "UART6"
  | "UART7"
  | "UART8"
  | "SOFTSERIAL1"
  | "SOFTSERIAL2"
  | `ID_${number}`;

/** Common iNav / CF serial function bits (subset for UI labels). */
export const SERIAL_FUNCTION_BITS: { bit: number; id: string }[] = [
  { bit: 0, id: "MSP" },
  { bit: 1, id: "GPS" },
  { bit: 3, id: "TELEMETRY_HOTT" },
  { bit: 4, id: "TELEMETRY_LTM" },
  { bit: 5, id: "TELEMETRY_SMARTPORT" },
  { bit: 6, id: "RX_SERIAL" },
  { bit: 7, id: "BLACKBOX" },
  { bit: 8, id: "TELEMETRY_MAVLINK" },
  { bit: 9, id: "TELEMETRY_IBUS" },
  { bit: 10, id: "RCDEVICE" },
  { bit: 11, id: "VTX_SMARTAUDIO" },
  { bit: 12, id: "VTX_TRAMP" },
  { bit: 14, id: "OPTICAL_FLOW" },
  { bit: 15, id: "LOG" },
  { bit: 16, id: "RANGEFINDER" },
  { bit: 18, id: "ESCSERIAL" },
  { bit: 20, id: "FRSKY_OSD" },
  { bit: 21, id: "DJI_HD_OSD" },
  { bit: 25, id: "MSP_OSD" },
];

export interface MspSerialPort {
  /** CLI / MSP identifier (0 = USB VCP on many boards, 1 = UART1, …). */
  identifier: number;
  functionMask: number;
  mspBaud: number;
  gpsBaud: number;
  telemetryBaud: number;
  blackboxBaud: number;
}

export interface MspModeRange {
  /** Slot index 0..N-1. */
  index: number;
  permanentId: number;
  auxChannelIndex: number;
  /** PWM start = 900 + startStep * 25. */
  startStep: number;
  /** PWM end = 900 + endStep * 25. */
  endStep: number;
}

export interface MspModesSnapshot {
  boxNames: string[];
  boxIds: number[];
  ranges: MspModeRange[];
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

/**
 * Map serial identifier → display label (best-effort).
 * iNav CLI uses 0=USB VCP, 1=UART1…; CF MSP often uses 20=USB_VCP, 0=UART1.
 * Prefer CLI-style for small ids (0..8) since Ports fallback is CLI on iNav.
 */
export function serialIdentifierLabel(id: number): SerialPortIdentifier {
  if (id === 20) return "USB_VCP";
  if (id === 30) return "SOFTSERIAL1";
  if (id === 31) return "SOFTSERIAL2";
  // CLI-style (iNav): 0 = USB, 1..8 = UART1..UART8
  if (id === 0) return "USB_VCP";
  if (id >= 1 && id <= 8) return `UART${id}` as SerialPortIdentifier;
  return `ID_${id}`;
}

export function serialFunctionLabels(mask: number): string[] {
  const labels = SERIAL_FUNCTION_BITS.filter(
    (f) => (mask & (1 << f.bit)) !== 0,
  ).map((f) => f.id);
  if (mask === 0) return ["NONE"];
  if (labels.length === 0) return [`0x${mask.toString(16)}`];
  return labels;
}

export function modeRangeToPwm(step: number): number {
  return 900 + step * 25;
}

export function pwmToModeRangeStep(pwm: number): number {
  return Math.max(0, Math.min(48, Math.round((pwm - 900) / 25)));
}

/**
 * Cleanflight / Betaflight CF_SERIAL_CONFIG layout (best-effort):
 * each port = identifier(u8) + functionMask(u16) + 4× baudIndex(u8) = 7 bytes
 * Newer builds may use u32 function mask (9 bytes). Detect by length.
 */
export function parseCfSerialConfig(payload: Uint8Array): MspSerialPort[] | null {
  if (payload.length === 0) return null;
  const baudFromIndex = (idx: number): number => {
    const table = [9600, 19200, 38400, 57600, 115200, 230400, 250000, 460800, 921600];
    return table[idx] ?? 115200;
  };

  // Prefer 9-byte records (u32 mask) when divisible.
  if (payload.length % 9 === 0) {
    const ports: MspSerialPort[] = [];
    for (let i = 0; i < payload.length; i += 9) {
      ports.push({
        identifier: payload[i]!,
        functionMask: readU32LE(payload, i + 1),
        mspBaud: baudFromIndex(payload[i + 5]!),
        gpsBaud: baudFromIndex(payload[i + 6]!),
        telemetryBaud: baudFromIndex(payload[i + 7]!),
        blackboxBaud: baudFromIndex(payload[i + 8]!),
      });
    }
    return ports;
  }

  if (payload.length % 7 === 0) {
    const ports: MspSerialPort[] = [];
    for (let i = 0; i < payload.length; i += 7) {
      ports.push({
        identifier: payload[i]!,
        functionMask: readU16LE(payload, i + 1),
        mspBaud: baudFromIndex(payload[i + 3]!),
        gpsBaud: baudFromIndex(payload[i + 4]!),
        telemetryBaud: baudFromIndex(payload[i + 5]!),
        blackboxBaud: baudFromIndex(payload[i + 6]!),
      });
    }
    return ports;
  }

  return null;
}

/** Encode CF serial config as 7-byte records (legacy). Baud rates → nearest index. */
export function encodeCfSerialConfig(ports: MspSerialPort[]): Uint8Array {
  const baudIndex = (baud: number): number => {
    const table = [9600, 19200, 38400, 57600, 115200, 230400, 250000, 460800, 921600];
    let best = 4;
    let bestDiff = Infinity;
    for (let i = 0; i < table.length; i++) {
      const d = Math.abs(table[i]! - baud);
      if (d < bestDiff) {
        bestDiff = d;
        best = i;
      }
    }
    return best;
  };
  const out = new Uint8Array(ports.length * 7);
  ports.forEach((p, idx) => {
    const o = idx * 7;
    out[o] = p.identifier & 0xff;
    out[o + 1] = p.functionMask & 0xff;
    out[o + 2] = (p.functionMask >> 8) & 0xff;
    out[o + 3] = baudIndex(p.mspBaud);
    out[o + 4] = baudIndex(p.gpsBaud);
    out[o + 5] = baudIndex(p.telemetryBaud);
    out[o + 6] = baudIndex(p.blackboxBaud);
  });
  return out;
}

/**
 * Parse CLI `serial` listing lines, e.g.:
 * `serial 0 1 115200 115200 115200 115200`
 */
export function parseCliSerialLines(text: string): MspSerialPort[] {
  const ports: MspSerialPort[] = [];
  const re =
    /^\s*serial\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$/gim;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    ports.push({
      identifier: Number(m[1]),
      functionMask: Number(m[2]),
      mspBaud: Number(m[3]),
      gpsBaud: Number(m[4]),
      telemetryBaud: Number(m[5]),
      blackboxBaud: Number(m[6]),
    });
  }
  return ports;
}

export function formatCliSerialLine(port: MspSerialPort): string {
  return `serial ${port.identifier} ${port.functionMask} ${port.mspBaud} ${port.gpsBaud} ${port.telemetryBaud} ${port.blackboxBaud}`;
}

/** BOXNAMES: null-separated C strings. */
export function parseBoxNames(payload: Uint8Array): string[] {
  const names: string[] = [];
  let cur = "";
  for (let i = 0; i < payload.length; i++) {
    const c = payload[i]!;
    if (c === 0 || c === 0x3b /* ';' used by some FCs */) {
      if (cur) names.push(cur);
      cur = "";
      continue;
    }
    if (c >= 32 && c < 127) cur += String.fromCharCode(c);
  }
  if (cur) names.push(cur);
  return names;
}

/** BOXIDS: one uint8 permanent id per box. */
export function parseBoxIds(payload: Uint8Array): number[] {
  return Array.from(payload);
}

/**
 * MODE_RANGES: 4 bytes per slot — permanentId, auxChannelIndex, startStep, endStep.
 * (iNav docs; some BF builds prepend sequence — we treat first byte as permanentId.)
 */
export function parseModeRanges(payload: Uint8Array): MspModeRange[] {
  const ranges: MspModeRange[] = [];
  if (payload.length % 4 !== 0) return ranges;
  for (let i = 0; i < payload.length; i += 4) {
    ranges.push({
      index: i / 4,
      permanentId: payload[i]!,
      auxChannelIndex: payload[i + 1]!,
      startStep: payload[i + 2]!,
      endStep: payload[i + 3]!,
    });
  }
  return ranges;
}

export function encodeSetModeRange(range: MspModeRange): Uint8Array {
  return new Uint8Array([
    range.index & 0xff,
    range.permanentId & 0xff,
    range.auxChannelIndex & 0xff,
    range.startStep & 0xff,
    range.endStep & 0xff,
  ]);
}

export function encodeEepromWriteRequest(): Uint8Array {
  return encodeMspRequest(MSP_EEPROM_WRITE);
}

export function encodeSetModeRangeRequest(range: MspModeRange): Uint8Array {
  return encodeMspV1(MSP_SET_MODE_RANGE, encodeSetModeRange(range));
}

export function encodeSetCfSerialConfigRequest(ports: MspSerialPort[]): Uint8Array {
  return encodeMspV1(MSP_SET_CF_SERIAL_CONFIG, encodeCfSerialConfig(ports));
}

export function boxNameForPermanentId(
  permanentId: number,
  boxIds: number[],
  boxNames: string[],
): string {
  const idx = boxIds.indexOf(permanentId);
  if (idx >= 0 && boxNames[idx]) return boxNames[idx]!;
  return `ID ${permanentId}`;
}

/** Serialize ports/modes snapshot for automatic diff backup text. */
export function formatConfigBackupText(opts: {
  kind: "ports" | "modes";
  ports?: MspSerialPort[];
  modes?: MspModesSnapshot;
  source?: string;
}): string {
  const lines: string[] = [
    `# Aether iNav ${opts.kind} backup`,
    `# source: ${opts.source ?? "unknown"}`,
    `# created: ${new Date().toISOString()}`,
  ];
  if (opts.kind === "ports" && opts.ports) {
    for (const p of opts.ports) {
      lines.push(formatCliSerialLine(p));
    }
  }
  if (opts.kind === "modes" && opts.modes) {
    for (const r of opts.modes.ranges) {
      const name = boxNameForPermanentId(
        r.permanentId,
        opts.modes.boxIds,
        opts.modes.boxNames,
      );
      lines.push(
        `# mode ${r.index} ${name} aux${r.auxChannelIndex + 1} ${modeRangeToPwm(r.startStep)}-${modeRangeToPwm(r.endStep)}`,
      );
      lines.push(
        `mode ${r.index} ${r.permanentId} ${r.auxChannelIndex} ${r.startStep} ${r.endStep}`,
      );
    }
  }
  return `${lines.join("\n")}\n`;
}
