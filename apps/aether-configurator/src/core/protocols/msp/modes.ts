/**
 * MSP Modes / AUX ranges (Betaflight & iNav compatible).
 * MODE_RANGES / SET_MODE_RANGE / BOXNAMES / BOXIDS.
 */

export interface MspModeRange {
  /** Slot index 0..N-1 (sent as first byte of SET_MODE_RANGE). */
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

export function modeRangeToPwm(step: number): number {
  return 900 + step * 25;
}

export function pwmToModeRangeStep(pwm: number): number {
  return Math.max(0, Math.min(48, Math.round((pwm - 900) / 25)));
}

/** BOXNAMES: null- or semicolon-separated C strings. */
export function parseBoxNames(payload: Uint8Array): string[] {
  const names: string[] = [];
  let cur = "";
  for (let i = 0; i < payload.length; i++) {
    const c = payload[i]!;
    if (c === 0 || c === 0x3b) {
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

/** Payload for MSP_SET_MODE_RANGE. */
export function encodeSetModeRange(range: MspModeRange): Uint8Array {
  return new Uint8Array([
    range.index & 0xff,
    range.permanentId & 0xff,
    range.auxChannelIndex & 0xff,
    range.startStep & 0xff,
    range.endStep & 0xff,
  ]);
}

export function boxNameForPermanentId(
  permanentId: number,
  boxIds: number[],
  boxNames: string[],
): string {
  const idx = boxIds.indexOf(permanentId);
  if (idx >= 0 && boxNames[idx]) return boxNames[idx]!;
  if (permanentId === 0) return "—";
  return `ID ${permanentId}`;
}

export function isRangeActive(range: MspModeRange): boolean {
  return (
    range.permanentId !== 0 || range.startStep !== 0 || range.endStep !== 0
  );
}

/** Clear a slot (unused). */
export function emptyModeRange(index: number): MspModeRange {
  return {
    index,
    permanentId: 0,
    auxChannelIndex: 0,
    startStep: 0,
    endStep: 0,
  };
}

/** Map PWM 900–2100 onto 0–100% for the range bar. */
export function pwmBarPercent(pwm: number): number {
  return Math.max(0, Math.min(100, ((pwm - 900) / 1200) * 100));
}

export function isPwmInRange(
  pwm: number,
  startStep: number,
  endStep: number,
): boolean {
  const start = modeRangeToPwm(startStep);
  const end = modeRangeToPwm(endStep);
  return pwm >= start && pwm <= end;
}
