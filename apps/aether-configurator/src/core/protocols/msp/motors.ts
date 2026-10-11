/** MSP motor telemetry + SET_MOTOR helpers. */

export const MOTOR_STOP = 1000;
/** Hard safety ceiling for configurator motor tests. */
export const MOTOR_TEST_MAX = 1150;
export const MOTOR_COUNT = 8;

export function parseMotorValues(payload: Uint8Array): number[] {
  const count = Math.min(MOTOR_COUNT, Math.floor(payload.length / 2));
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push(payload[i * 2]! | (payload[i * 2 + 1]! << 8));
  }
  while (out.length < MOTOR_COUNT) out.push(MOTOR_STOP);
  return out;
}

export function encodeSetMotor(values: number[]): Uint8Array {
  const out = new Uint8Array(MOTOR_COUNT * 2);
  for (let i = 0; i < MOTOR_COUNT; i++) {
    const v = Math.max(
      MOTOR_STOP,
      Math.min(MOTOR_TEST_MAX, Math.round(values[i] ?? MOTOR_STOP)),
    );
    out[i * 2] = v & 0xff;
    out[i * 2 + 1] = (v >> 8) & 0xff;
  }
  return out;
}

export function stoppedMotors(): number[] {
  return Array.from({ length: MOTOR_COUNT }, () => MOTOR_STOP);
}
