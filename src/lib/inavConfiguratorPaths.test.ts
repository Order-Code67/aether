import { describe, expect, it } from "vitest";
import { inavConfiguratorCandidatePaths } from "./inavConfiguratorPaths";

describe("inavConfiguratorCandidatePaths", () => {
  it("includes LocalAppData and Program Files layouts", () => {
    const paths = inavConfiguratorCandidatePaths({
      localAppData: "C:\\Users\\u\\AppData\\Local",
      programFiles: "C:\\Program Files",
      programFilesX86: "C:\\Program Files (x86)",
      pathEntries: ["C:\\Tools\\bin"],
    });
    expect(paths.some((p) => p.includes("Programs\\inav-configurator"))).toBe(
      true,
    );
    expect(paths.some((p) => p.includes("Program Files\\INAV Configurator"))).toBe(
      true,
    );
    expect(paths.some((p) => p.endsWith("C:\\Tools\\bin\\INAV Configurator.exe"))).toBe(
      true,
    );
    expect(paths.every((p) => p.includes("Configurator") || p.includes("configurator"))).toBe(
      true,
    );
  });

  it("dedupes case-insensitively", () => {
    const paths = inavConfiguratorCandidatePaths({
      localAppData: "C:\\Local",
      pathEntries: ["C:\\Local\\Programs\\inav-configurator"],
    });
    const lower = paths.map((p) => p.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
  });
});
