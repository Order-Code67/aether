/**
 * MSP telemetry parsers for Setup (attitude, RC, raw IMU).
 */

export interface AttitudeSnapshot {
  /** Degrees. */
  roll: number;
  pitch: number;
  /** Degrees 0–360. */
  yaw: number;
  updatedAt: number;
}

export interface RcChannels {
  channels: number[];
  updatedAt: number;
}

export interface RawImuSnapshot {
  acc: { x: number; y: number; z: number };
  gyro: { x: number; y: number; z: number };
  mag: { x: number; y: number; z: number };
  updatedAt: number;
}

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
] as const;

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
    updatedAt: Date.now(),
  };
}

/**
 * MSP_RAW_IMU: 9 × int16 — acc[3], gyro[3], mag[3].
 * Units are FC-native (raw ADC counts); used for presence / noise checks.
 */
export function parseRawImu(payload: Uint8Array): RawImuSnapshot | null {
  if (payload.length < 18) return null;
  return {
    acc: {
      x: readI16LE(payload, 0),
      y: readI16LE(payload, 2),
      z: readI16LE(payload, 4),
    },
    gyro: {
      x: readI16LE(payload, 6),
      y: readI16LE(payload, 8),
      z: readI16LE(payload, 10),
    },
    mag: {
      x: readI16LE(payload, 12),
      y: readI16LE(payload, 14),
      z: readI16LE(payload, 16),
    },
    updatedAt: Date.now(),
  };
}

/** Map PWM 1000–2000 → 0–100% for bar width. */
export function rcChannelPercent(pwm: number): number {
  return Math.max(0, Math.min(100, ((pwm - 1000) / 1000) * 100));
}

/** True when stick/channel is near mid (for Roll/Pitch/Yaw check). */
export function isChannelCentered(pwm: number, tolerance = 50): boolean {
  return Math.abs(pwm - 1500) <= tolerance;
}
