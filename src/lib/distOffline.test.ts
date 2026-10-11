import { describe, expect, it } from "vitest";
import {
  classifyAetherOfflineZipName,
  pickPreferredSidecarZip,
} from "./distOffline";

describe("distOffline", () => {
  it("classifies OfflineCache and OfflineLibs zip names", () => {
    expect(
      classifyAetherOfflineZipName("Aether_OfflineCache_0.2.33_windows-x64.zip"),
    ).toBe("full");
    expect(
      classifyAetherOfflineZipName("Aether_OfflineLibs_0.2.33_windows-x64.zip"),
    ).toBe("libs");
    expect(classifyAetherOfflineZipName("random.zip")).toBeNull();
  });

  it("prefers full cache over libs-only", () => {
    const pick = pickPreferredSidecarZip([
      { path: "C:\\libs.zip", kind: "libs" },
      { path: "C:\\full.zip", kind: "full" },
    ]);
    expect(pick?.path).toBe("C:\\full.zip");
  });
});
