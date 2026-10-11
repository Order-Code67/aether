import { describe, expect, it } from "vitest";
import { presetToCliLines, getFcPreset } from "./fcPresets";
import {
  formatPidCliLines,
  parseAttitude,
  parseLegacyPid,
  parseRcChannels,
  tuningFromCliText,
} from "./mspTuning";

describe("mspTuning parsers", () => {
  it("parses MSP_RC channels", () => {
    const payload = new Uint8Array([
      0xe8, 0x03, // 1000
      0xdc, 0x05, // 1500
      0xd0, 0x07, // 2000
    ]);
    const rc = parseRcChannels(payload);
    expect(rc?.channels).toEqual([1000, 1500, 2000]);
  });

  it("parses attitude", () => {
    // roll = 125 (12.5°), pitch = -50 (-5.0°), yaw = 180
    const payload = new Uint8Array([125, 0, 0xce, 0xff, 180, 0]);
    const att = parseAttitude(payload);
    expect(att?.roll).toBe(12.5);
    expect(att?.pitch).toBe(-5);
    expect(att?.yaw).toBe(180);
  });

  it("parses legacy PID", () => {
    const pid = parseLegacyPid(new Uint8Array([40, 30, 20, 41, 31, 21, 70, 45, 0]));
    expect(pid?.roll.p).toBe(40);
    expect(pid?.yaw.p).toBe(70);
  });
});

describe("mspTuning CLI", () => {
  it("builds tuning snapshot from dump text", () => {
    const text = `
set mc_p_roll = 44
set mc_i_roll = 40
set mc_d_roll = 24
set mc_ff_roll = 40
set mc_p_pitch = 48
set mc_i_pitch = 45
set mc_d_pitch = 26
set mc_ff_pitch = 40
set mc_p_yaw = 70
set mc_i_yaw = 45
set mc_d_yaw = 0
set mc_ff_yaw = 0
set roll_rate = 70
set pitch_rate = 70
set yaw_rate = 60
set failsafe_procedure = RTH
set battery_capacity = 1500
mixer QUADX
feature GPS
`;
    const snap = tuningFromCliText(text);
    expect(snap.pid?.family).toBe("mc");
    expect(snap.pid?.roll.p).toBe(44);
    expect(snap.rates?.rollRate).toBe(70);
    expect(snap.failsafe?.procedure).toBe("RTH");
    expect(snap.battery?.capacity).toBe(1500);
    expect(snap.mixer?.mixer).toBe("QUADX");
    expect(formatPidCliLines(snap.pid!).some((l) => l.includes("mc_p_roll"))).toBe(
      true,
    );
  });
});

describe("fcPresets", () => {
  it("expands freestyle preset to CLI lines", () => {
    const preset = getFcPreset("mr_freestyle");
    expect(preset).toBeTruthy();
    const lines = presetToCliLines(preset!);
    expect(lines.some((l) => l.startsWith("mixer "))).toBe(true);
    expect(lines.some((l) => l.includes("mc_p_roll"))).toBe(true);
    expect(lines.some((l) => l.includes("failsafe_procedure"))).toBe(true);
  });
});
