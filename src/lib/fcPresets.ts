/**
 * Vehicle presets combining the best of:
 * - Betaflight: race / freestyle / cinematic rate+PID feel
 * - iNav: GPS nav, RTH, airplane / flying wing
 * - ArduPilot: clear vehicle classes + failsafe philosophy
 *
 * Applied as CLI lines (RAM). EEPROM save stays explicit.
 */

import type { FailsafeConfig, MixerInfo, PidProfile, RatesProfile } from "@/lib/mspTuning";
import {
  formatBatteryCliLines,
  formatFailsafeCliLines,
  formatMixerCliLines,
  formatPidCliLines,
  formatRatesCliLines,
} from "@/lib/mspTuning";

export type FcPresetId =
  | "mr_freestyle"
  | "mr_cinematic"
  | "mr_race"
  | "mr_longrange"
  | "plane_trainer"
  | "plane_cruise"
  | "wing_sport"
  | "wing_cruise";

export interface FcPreset {
  id: FcPresetId;
  /** i18n key suffix under inav.presets.* */
  nameKey: string;
  descKey: string;
  /** Source inspiration tags for UI. */
  inspiredBy: ("betaflight" | "inav" | "ardupilot")[];
  craft: "multirotor" | "airplane" | "wing";
  pid: PidProfile;
  rates: RatesProfile;
  mixer: MixerInfo;
  failsafe: FailsafeConfig;
  /** Extra CLI set lines. */
  extraCli: string[];
  batteryCapacityHint?: number;
}

const rates = (
  roll: number,
  pitch: number,
  yaw: number,
  expo: number,
  yawExpo: number,
): RatesProfile => ({
  rollRate: roll,
  pitchRate: pitch,
  yawRate: yaw,
  rcExpo: expo,
  rcYawExpo: yawExpo,
  thrMid: 50,
  thrExpo: 0,
  tpaRate: 20,
  tpaBreakpoint: 1500,
});

const pid = (
  family: "mc" | "fw",
  roll: [number, number, number, number],
  pitch: [number, number, number, number],
  yaw: [number, number, number, number],
): PidProfile => ({
  family,
  roll: { p: roll[0], i: roll[1], d: roll[2], ff: roll[3] },
  pitch: { p: pitch[0], i: pitch[1], d: pitch[2], ff: pitch[3] },
  yaw: { p: yaw[0], i: yaw[1], d: yaw[2], ff: yaw[3] },
});

export const FC_PRESETS: FcPreset[] = [
  {
    id: "mr_freestyle",
    nameKey: "inav.presets.mrFreestyle",
    descKey: "inav.presets.mrFreestyleDesc",
    inspiredBy: ["betaflight", "inav"],
    craft: "multirotor",
    pid: pid("mc", [44, 40, 24, 40], [48, 45, 26, 40], [70, 45, 0, 0]),
    rates: rates(70, 70, 60, 30, 20),
    mixer: { mixer: "QUADX", platformType: "MULTIROTOR" },
    failsafe: { procedure: "RTH", delayMs: 10, throttle: 1000 },
    extraCli: [
      "feature GPS",
      "feature TELEMETRY",
      "feature AIRMODE",
      "set nav_rth_allow_landing = ALWAYS",
    ],
    batteryCapacityHint: 1500,
  },
  {
    id: "mr_cinematic",
    nameKey: "inav.presets.mrCinematic",
    descKey: "inav.presets.mrCinematicDesc",
    inspiredBy: ["betaflight", "inav"],
    craft: "multirotor",
    pid: pid("mc", [36, 45, 22, 30], [38, 48, 24, 30], [55, 40, 0, 0]),
    rates: rates(45, 45, 40, 50, 40),
    mixer: { mixer: "QUADX", platformType: "MULTIROTOR" },
    failsafe: { procedure: "RTH", delayMs: 10, throttle: 1000 },
    extraCli: [
      "feature GPS",
      "feature TELEMETRY",
      "set nav_user_control_mode = CRUISE",
    ],
    batteryCapacityHint: 3000,
  },
  {
    id: "mr_race",
    nameKey: "inav.presets.mrRace",
    descKey: "inav.presets.mrRaceDesc",
    inspiredBy: ["betaflight"],
    craft: "multirotor",
    pid: pid("mc", [52, 50, 28, 50], [56, 55, 30, 50], [80, 50, 0, 0]),
    rates: rates(85, 85, 75, 10, 10),
    mixer: { mixer: "QUADX", platformType: "MULTIROTOR" },
    failsafe: { procedure: "DROP", delayMs: 5, throttle: 1000 },
    extraCli: ["feature AIRMODE", "feature TELEMETRY"],
    batteryCapacityHint: 1100,
  },
  {
    id: "mr_longrange",
    nameKey: "inav.presets.mrLongrange",
    descKey: "inav.presets.mrLongrangeDesc",
    inspiredBy: ["inav", "ardupilot"],
    craft: "multirotor",
    pid: pid("mc", [40, 42, 22, 35], [42, 45, 24, 35], [65, 42, 0, 0]),
    rates: rates(55, 55, 50, 40, 30),
    mixer: { mixer: "QUADX", platformType: "MULTIROTOR" },
    failsafe: { procedure: "RTH", delayMs: 15, throttle: 1000 },
    extraCli: [
      "feature GPS",
      "feature TELEMETRY",
      "set nav_rth_altitude = 50",
      "set nav_rth_climb_first = ON",
      "set failsafe_mission = ON",
    ],
    batteryCapacityHint: 4500,
  },
  {
    id: "plane_trainer",
    nameKey: "inav.presets.planeTrainer",
    descKey: "inav.presets.planeTrainerDesc",
    inspiredBy: ["inav", "ardupilot"],
    craft: "airplane",
    pid: pid("fw", [10, 5, 5, 50], [12, 5, 5, 50], [20, 0, 0, 0]),
    rates: rates(40, 40, 30, 40, 30),
    mixer: { mixer: "AIRPLANE", platformType: "AIRPLANE" },
    failsafe: { procedure: "RTH", delayMs: 20, throttle: 1200 },
    extraCli: [
      "feature GPS",
      "feature TELEMETRY",
      "set nav_fw_cruise_thr = 1400",
      "set nav_fw_min_thr = 1200",
      "set nav_fw_max_thr = 1800",
      "set nav_rth_altitude = 80",
    ],
    batteryCapacityHint: 2200,
  },
  {
    id: "plane_cruise",
    nameKey: "inav.presets.planeCruise",
    descKey: "inav.presets.planeCruiseDesc",
    inspiredBy: ["inav", "ardupilot"],
    craft: "airplane",
    pid: pid("fw", [12, 8, 6, 60], [14, 8, 6, 60], [25, 0, 0, 0]),
    rates: rates(50, 50, 35, 30, 25),
    mixer: { mixer: "AIRPLANE", platformType: "AIRPLANE" },
    failsafe: { procedure: "RTH", delayMs: 15, throttle: 1300 },
    extraCli: [
      "feature GPS",
      "feature TELEMETRY",
      "set nav_fw_cruise_thr = 1500",
      "set nav_rth_altitude = 100",
      "set nav_rth_climb_first = ON",
    ],
    batteryCapacityHint: 4000,
  },
  {
    id: "wing_sport",
    nameKey: "inav.presets.wingSport",
    descKey: "inav.presets.wingSportDesc",
    inspiredBy: ["inav", "betaflight"],
    craft: "wing",
    pid: pid("fw", [14, 6, 5, 70], [16, 6, 5, 70], [0, 0, 0, 0]),
    rates: rates(65, 65, 40, 20, 15),
    mixer: { mixer: "FLYING_WING", platformType: "AIRPLANE" },
    failsafe: { procedure: "RTH", delayMs: 12, throttle: 1250 },
    extraCli: [
      "feature GPS",
      "feature TELEMETRY",
      "set nav_fw_cruise_thr = 1450",
      "set nav_rth_altitude = 70",
    ],
    batteryCapacityHint: 1800,
  },
  {
    id: "wing_cruise",
    nameKey: "inav.presets.wingCruise",
    descKey: "inav.presets.wingCruiseDesc",
    inspiredBy: ["inav", "ardupilot"],
    craft: "wing",
    pid: pid("fw", [11, 5, 4, 55], [12, 5, 4, 55], [0, 0, 0, 0]),
    rates: rates(50, 50, 30, 35, 25),
    mixer: { mixer: "FLYING_WING", platformType: "AIRPLANE" },
    failsafe: { procedure: "RTH", delayMs: 18, throttle: 1200 },
    extraCli: [
      "feature GPS",
      "feature TELEMETRY",
      "set nav_fw_cruise_thr = 1400",
      "set nav_rth_altitude = 90",
      "set nav_rth_allow_landing = NEVER",
    ],
    batteryCapacityHint: 3000,
  },
];

export function getFcPreset(id: FcPresetId): FcPreset | undefined {
  return FC_PRESETS.find((p) => p.id === id);
}

/** Expand a preset into CLI lines for Apply (no save). */
export function presetToCliLines(preset: FcPreset): string[] {
  const lines: string[] = [
    ...formatMixerCliLines(preset.mixer),
    ...formatPidCliLines(preset.pid),
    ...formatRatesCliLines(preset.rates),
    ...formatFailsafeCliLines(preset.failsafe),
    ...preset.extraCli,
  ];
  if (preset.batteryCapacityHint != null) {
    lines.push(
      ...formatBatteryCliLines({
        vbatMinCell: 330,
        vbatMaxCell: 430,
        vbatWarningCell: 350,
        capacity: preset.batteryCapacityHint,
        voltageScale: 1100,
        currentScale: 400,
      }),
    );
  }
  return lines;
}
