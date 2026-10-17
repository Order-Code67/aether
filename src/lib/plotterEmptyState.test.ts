import { describe, expect, it } from "vitest";
import { plotterEmptyReason, serialEmptyReason } from "./plotterEmptyState";

describe("plotterEmptyReason", () => {
  it("asks to connect when serial is down", () => {
    expect(
      plotterEmptyReason({
        connected: false,
        paused: false,
        parseMode: "text",
        preset: "custom",
        hasPoints: false,
        visibleChannelCount: 0,
        channelCount: 0,
      }),
    ).toBe("need_connect");
  });

  it("explains MSP wait when preset is msp", () => {
    expect(
      plotterEmptyReason({
        connected: true,
        paused: false,
        parseMode: "text",
        preset: "msp",
        hasPoints: false,
        visibleChannelCount: 0,
        channelCount: 0,
      }),
    ).toBe("waiting_msp");
  });

  it("returns null when there is visible data", () => {
    expect(
      plotterEmptyReason({
        connected: true,
        paused: false,
        parseMode: "text",
        preset: "rssi-snr",
        hasPoints: true,
        visibleChannelCount: 2,
        channelCount: 2,
      }),
    ).toBeNull();
  });
});

describe("serialEmptyReason", () => {
  it("flags empty COM list", () => {
    expect(
      serialEmptyReason({
        connected: false,
        portsEmpty: true,
        hasLines: false,
      }),
    ).toBe("no_ports");
  });

  it("waits for data when connected", () => {
    expect(
      serialEmptyReason({
        connected: true,
        portsEmpty: false,
        hasLines: false,
      }),
    ).toBe("waiting_data");
  });
});
