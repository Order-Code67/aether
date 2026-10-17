import { describe, expect, it } from "vitest";
import { regionIdFromIni, syncLoraRegionFlagsInIni } from "./loraIniSync";

const SAMPLE = `
[env:heltec_wifi_lora_32_V3]
build_flags =
	-DAETHER_LORA_REGION_EU868
	-DAETHER_LORA_FREQ=868.1
	-DAETHER_LORA_SF=7

[env:esp32dev]
build_flags =
	-DAETHER_LORA_REGION_EU868
	-DAETHER_LORA_FREQ=868.1
`;

describe("syncLoraRegionFlagsInIni", () => {
  it("rewrites region and freq on every env", () => {
    const next = syncLoraRegionFlagsInIni(SAMPLE, "US915");
    expect(next).toContain("-DAETHER_LORA_REGION_US915");
    expect(next).toContain("-DAETHER_LORA_FREQ=915");
    expect(next).not.toContain("EU868");
    expect(next).not.toContain("868.1");
    expect(regionIdFromIni(next)).toBe("US915");
  });

  it("reads region from ini", () => {
    expect(regionIdFromIni(SAMPLE)).toBe("EU868");
  });
});
