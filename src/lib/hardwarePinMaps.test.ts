import { describe, expect, it } from "vitest";
import {
  formatPinMapForPrompt,
  resolveLoraPinMap,
} from "./hardwarePinMaps";
import { analyzeRadioProject } from "./radioDoctor";
import {
  buildBoardHardwareContext,
  parsePlatformioIniSnippet,
} from "./projectBoardContext";
import { getLoraRegion } from "./loraRegions";
import { stacksForPlatform } from "./libraryStacks";

describe("resolveLoraPinMap", () => {
  it("resolves Heltec V3 and Mega", () => {
    expect(resolveLoraPinMap("heltec_wifi_lora_32_V3")?.nss).toBe(8);
    expect(resolveLoraPinMap("megaatmega2560")?.dio).toBe(2);
  });

  it("formats prompt text", () => {
    const map = resolveLoraPinMap("ttgo-t-beam");
    expect(map).toBeTruthy();
    expect(formatPinMapForPrompt(map!)).toContain("NSS=");
  });
});

describe("lora regions & stacks", () => {
  it("defaults EU868", () => {
    expect(getLoraRegion(undefined).freqMhz).toBe(868.1);
    expect(getLoraRegion("US915").freqMhz).toBe(915.0);
  });

  it("exposes LoRa stack for esp32", () => {
    const stacks = stacksForPlatform("esp32");
    expect(stacks.some((s) => s.id === "lora")).toBe(true);
    expect(stacks.find((s) => s.id === "lora")?.specs).toContain(
      "jgromes/RadioLib",
    );
  });
});

describe("radio doctor & board context", () => {
  it("detects RadioLib projects", () => {
    const hints = analyzeRadioProject(
      "lib_deps =\n\tjgromes/RadioLib\n",
      "heltec_wifi_lora_32_V3",
    );
    expect(hints.isRadioProject).toBe(true);
    expect(hints.tipsEn.length).toBeGreaterThan(0);
  });

  it("parses ini and builds AI context", () => {
    const ini = `
[env:esp32dev]
board = esp32dev
lib_deps =
	jgromes/RadioLib
	bblanchon/ArduinoJson
build_flags =
	-DAETHER_LORA_FREQ=868.1
`;
    const parsed = parsePlatformioIniSnippet(ini);
    expect(parsed.board).toBe("esp32dev");
    expect(parsed.libDeps).toContain("jgromes/RadioLib");
    const ctx = buildBoardHardwareContext({
      selectedEnv: "esp32dev",
      iniText: ini,
    });
    expect(ctx).toContain("lib_deps");
    expect(ctx).toContain("NSS=");
    expect(ctx).toContain("platformio.ini env section");
  });

  it("scopes multi-env ini to selected env", () => {
    const ini = `
[env:heltec_wifi_lora_32_V3]
board = heltec_wifi_lora_32_V3
lib_deps =
	jgromes/RadioLib
build_flags =
	-DAETHER_LORA_NSS=8

[env:esp32dev]
board = esp32dev
lib_deps =
	bblanchon/ArduinoJson
build_flags =
	-DAETHER_LORA_NSS=5
`;
    const heltec = parsePlatformioIniSnippet(ini, "heltec_wifi_lora_32_V3");
    expect(heltec.board).toBe("heltec_wifi_lora_32_V3");
    expect(heltec.libDeps).toContain("jgromes/RadioLib");
    expect(heltec.buildFlags.some((f) => f.includes("NSS=8"))).toBe(true);

    const esp = parsePlatformioIniSnippet(ini, "esp32dev");
    expect(esp.board).toBe("esp32dev");
    expect(esp.libDeps).toContain("bblanchon/ArduinoJson");
    expect(esp.buildFlags.some((f) => f.includes("NSS=5"))).toBe(true);
  });
});
