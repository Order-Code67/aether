import { describe, expect, it } from "vitest";
import { lineLooksLikeRadioFail } from "./radioSerialDoctor";

describe("lineLooksLikeRadioFail", () => {
  it("catches LoRa init / join failures", () => {
    expect(lineLooksLikeRadioFail("[RadioLib] init fail")).toBe(true);
    expect(lineLooksLikeRadioFail("LoRaWAN join failed")).toBe(true);
    expect(lineLooksLikeRadioFail("SX1262 begin failed")).toBe(true);
  });

  it("ignores unrelated noise", () => {
    expect(lineLooksLikeRadioFail("temp:23.5")).toBe(false);
    expect(lineLooksLikeRadioFail("RX: aether#1 RSSI=-91.0 dBm")).toBe(false);
  });
});
