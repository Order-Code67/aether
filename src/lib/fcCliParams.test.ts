import { describe, expect, it } from "vitest";
import {
  filterCliParams,
  formatCliParamWrite,
  groupForParam,
  parseCliParams,
} from "./fcCliParams";

const SAMPLE = `
# version
# INAV / ...
set mc_p_roll = 44
set mc_i_roll = 40
set nav_rth_altitude = 50
set failsafe_procedure = RTH
feature GPS
feature -AIRMODE
mixer QUADX
set mc_p_roll = 48
`;

describe("fcCliParams", () => {
  it("parses set / feature / mixer and keeps last set value", () => {
    const params = parseCliParams(SAMPLE);
    const roll = params.find((p) => p.name === "mc_p_roll");
    expect(roll?.value).toBe("48");
    expect(params.find((p) => p.kind === "mixer")?.value).toBe("QUADX");
    expect(params.find((p) => p.name === "GPS")?.value).toBe("ON");
    expect(params.find((p) => p.name === "AIRMODE")?.value).toBe("OFF");
  });

  it("groups and filters like a parameter browser", () => {
    const params = parseCliParams(SAMPLE);
    expect(groupForParam("mc_p_roll")).toBe("pid_mc");
    expect(groupForParam("nav_rth_altitude")).toBe("gps_nav");
    const filtered = filterCliParams(params, "rth", "all");
    expect(filtered.some((p) => p.name === "nav_rth_altitude")).toBe(true);
    expect(filtered.some((p) => p.name === "mc_p_roll")).toBe(false);
  });

  it("formats writes", () => {
    expect(
      formatCliParamWrite({
        name: "mc_p_roll",
        value: "40",
        raw: "",
        kind: "set",
      }),
    ).toBe("set mc_p_roll = 40");
    expect(
      formatCliParamWrite({
        name: "GPS",
        value: "OFF",
        raw: "",
        kind: "feature",
      }),
    ).toBe("feature -GPS");
  });
});
