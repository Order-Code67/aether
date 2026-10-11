/** MSP / CLI serial port configuration helpers. */

export interface MspSerialPort {
  identifier: number;
  functionMask: number;
  mspBaud: number;
  gpsBaud: number;
  telemetryBaud: number;
  blackboxBaud: number;
}

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
  { bit: 15, id: "OSD" },
  { bit: 18, id: "ESCSERIAL" },
  { bit: 25, id: "MSP_OSD" },
];

const BAUD_TABLE = [
  9600, 19200, 38400, 57600, 115200, 230400, 250000, 460800, 921600,
];

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

export function serialIdentifierLabel(id: number): string {
  if (id === 20 || id === 0) return "USB_VCP";
  if (id >= 1 && id <= 8) return `UART${id}`;
  if (id === 30) return "SOFTSERIAL1";
  if (id === 31) return "SOFTSERIAL2";
  return `ID_${id}`;
}

export function serialFunctionLabels(mask: number): string[] {
  const labels = SERIAL_FUNCTION_BITS.filter(
    (f) => (mask & (1 << f.bit)) !== 0,
  ).map((f) => f.id);
  if (mask === 0) return ["NONE"];
  return labels.length ? labels : [`0x${mask.toString(16)}`];
}

export function parseCfSerialConfig(payload: Uint8Array): MspSerialPort[] | null {
  if (payload.length === 0) return null;
  const baudFromIndex = (idx: number) => BAUD_TABLE[idx] ?? 115200;

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

export function toggleFunctionBit(mask: number, bit: number, on: boolean): number {
  return on ? mask | (1 << bit) : mask & ~(1 << bit);
}
