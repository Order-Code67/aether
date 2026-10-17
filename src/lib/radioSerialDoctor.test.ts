import { describe, expect, it } from "vitest";
import {
  lineLooksLikeRadioFail,
  lineLooksLikeRadioJoinOk,
  lineLooksLikeRadioRxOk,
  lineLooksLikeRadioUplinkOk,
} from "./radioSerialDoctor";

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

describe("lineLooksLikeRadioRxOk", () => {
  it("detects Aether RX packet lines", () => {
    expect(lineLooksLikeRadioRxOk("RX: aether#1 RSSI=-91.0 dBm SNR=7.5 dB")).toBe(
      true,
    );
    expect(lineLooksLikeRadioRxOk("noise")).toBe(false);
  });
});

describe("lineLooksLikeRadioJoinOk", () => {
  it("detects Join success", () => {
    expect(lineLooksLikeRadioJoinOk("OTAA joined")).toBe(true);
    expect(lineLooksLikeRadioJoinOk("network joined")).toBe(true);
    expect(lineLooksLikeRadioJoinOk("join failed")).toBe(false);
  });
});

describe("lineLooksLikeRadioUplinkOk", () => {
  it("detects TX OK", () => {
    expect(lineLooksLikeRadioUplinkOk("TX OK")).toBe(true);
    expect(lineLooksLikeRadioUplinkOk("uplink ok")).toBe(true);
  });
});
