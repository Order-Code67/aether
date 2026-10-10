import { describe, expect, it } from "vitest";
import { cameraReconnectDelayMs } from "./cameraCapture";

describe("cameraReconnectDelayMs", () => {
  it("grows with backoff and caps", () => {
    expect(cameraReconnectDelayMs(0)).toBe(500);
    expect(cameraReconnectDelayMs(1)).toBe(1000);
    expect(cameraReconnectDelayMs(2)).toBe(2000);
    expect(cameraReconnectDelayMs(10)).toBe(15_000);
  });
});
