import { describe, expect, it } from "vitest";
import {
  orderPlotChannels,
  parseSerialPlotLine,
  sampleHasRadioChannels,
} from "./serialPlotter";

describe("serialPlotter radio", () => {
  it("parses LoRa RX RSSI/SNR lines", () => {
    const sample = parseSerialPlotLine(
      "RX: aether#1  RSSI=-91.0 dBm  SNR=7.5 dB",
    );
    expect(sample).toBeTruthy();
    expect(sampleHasRadioChannels(sample!)).toBe(true);
    expect(sample!.RSSI).toBe(-91);
    expect(sample!.SNR).toBe(7.5);
  });

  it("orders RSSI/SNR before other channels", () => {
    expect(orderPlotChannels(["temp", "SNR", "RSSI", "ch0"])).toEqual([
      "RSSI",
      "SNR",
      "temp",
      "ch0",
    ]);
  });
});
