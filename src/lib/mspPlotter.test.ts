import { describe, expect, it } from "vitest";
import type { MspStatusSnapshot } from "./mspMinimal";
import { mspSnapshotToPlotSample } from "./mspPlotter";

describe("mspSnapshotToPlotSample", () => {
  it("maps analog RSSI and voltage", () => {
    const snap = {
      analog: {
        voltage: 12.6,
        mAhDrawn: 100,
        rssi: 88,
        amperage: 1.2,
      },
      status: null,
      gps: null,
      apiVersion: null,
      fcVariant: "INAV",
      fcVersion: null,
      name: "craft",
      isInav: true,
      updatedAt: 1,
    } satisfies MspStatusSnapshot;
    const sample = mspSnapshotToPlotSample(snap);
    expect(sample).toMatchObject({ RSSI: 88, voltage: 12.6, mAh: 100, amps: 1.2 });
  });
});
