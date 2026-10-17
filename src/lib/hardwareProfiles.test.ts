import { describe, expect, it } from "vitest";
import {
  featuredHardwarePresets,
  getHardwarePreset,
  HARDWARE_PROFILE_PRESETS,
} from "./hardwareProfiles";

describe("hardwareProfiles", () => {
  it("includes Heltec, T-Beam, Mega+RFM95, and FC/BPLA", () => {
    const ids = HARDWARE_PROFILE_PRESETS.map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "heltec-v3",
        "t-beam",
        "mega-sx1276",
        "fc-bpla",
      ]),
    );
  });

  it("marks featured templates for welcome one-clicks", () => {
    const featured = featuredHardwarePresets().map((p) => p.id);
    expect(featured).toContain("heltec-v3");
    expect(featured).toContain("fc-bpla");
  });

  it("FC template opens BPLA path", () => {
    expect(getHardwarePreset("fc-bpla")?.kind).toBe("bpla");
  });
});
