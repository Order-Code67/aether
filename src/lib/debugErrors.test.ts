import { describe, expect, it } from "vitest";
import { friendlyDebugError } from "./debugErrors";

describe("friendlyDebugError", () => {
  it("maps missing PlatformIO CLI", () => {
    expect(
      friendlyDebugError(
        "PlatformIO CLI not found. Install PlatformIO Core",
        "en",
      ),
    ).toMatch(/PlatformIO CLI not found/);
  });

  it("maps missing debug_tool in Russian", () => {
    expect(
      friendlyDebugError("Error: Unknown debug_tool xyz", "ru"),
    ).toMatch(/debug_tool/);
  });
});
