import { describe, expect, it } from "vitest";
import {
  buildFirmwareProfilesFile,
  FIRMWARE_PROFILES_FORMAT,
  mergeFirmwareProfiles,
  parseFirmwareProfilesJson,
  serializeFirmwareProfiles,
} from "./firmwareProfilesIo";
import type { FirmwareProfile } from "@/stores/firmwareProfileStore";

const sample: FirmwareProfile = {
  id: "fp_1",
  name: "ESP32 CAM",
  env: "esp32cam",
  uploadPort: "COM3",
  projectRootHint: "D:/proj",
  sketchPath: "src/main.cpp",
  monitorBaud: 115200,
  updatedAt: 1000,
};

describe("parseFirmwareProfilesJson", () => {
  it("accepts wrapped export file", () => {
    const json = serializeFirmwareProfiles([sample]);
    const result = parseFirmwareProfilesJson(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profiles).toHaveLength(1);
    expect(result.profiles[0]?.name).toBe("ESP32 CAM");
    expect(result.profiles[0]?.env).toBe("esp32cam");
  });

  it("accepts bare array", () => {
    const result = parseFirmwareProfilesJson(JSON.stringify([sample]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profiles[0]?.id).toBe("fp_1");
  });

  it("rejects invalid JSON", () => {
    const result = parseFirmwareProfilesJson("{");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorKey).toBe("profiles.importInvalidJson");
  });

  it("rejects wrong format / empty", () => {
    expect(
      parseFirmwareProfilesJson(
        JSON.stringify({ format: "other", version: 1, profiles: [sample] }),
      ).ok,
    ).toBe(false);
    expect(
      parseFirmwareProfilesJson(
        JSON.stringify({
          format: FIRMWARE_PROFILES_FORMAT,
          version: 1,
          profiles: [],
        }),
      ),
    ).toEqual({ ok: false, errorKey: "profiles.importEmpty" });
    expect(
      parseFirmwareProfilesJson(
        JSON.stringify({
          format: FIRMWARE_PROFILES_FORMAT,
          version: 1,
          profiles: [{ name: "", env: "x", uploadPort: "" }],
        }),
      ).ok,
    ).toBe(false);
  });
});

describe("mergeFirmwareProfiles", () => {
  it("imported id wins", () => {
    const older = { ...sample, name: "Old", updatedAt: 1 };
    const newer = { ...sample, name: "New", updatedAt: 2 };
    const merged = mergeFirmwareProfiles([older], [newer]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.name).toBe("New");
  });
});

describe("buildFirmwareProfilesFile", () => {
  it("sets format and version", () => {
    const file = buildFirmwareProfilesFile([sample]);
    expect(file.format).toBe(FIRMWARE_PROFILES_FORMAT);
    expect(file.version).toBe(1);
    expect(file.profiles[0]).toEqual(sample);
  });
});
