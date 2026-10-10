import { describe, expect, it } from "vitest";
import {
  clampPlotterZoom,
  plotPointsToCsv,
  slicePlotWindow,
} from "./plotterExport";
import type { PlotPoint } from "@/stores/plotterStore";

const points: PlotPoint[] = [
  { t: 1, values: { a: 1, b: 10 } },
  { t: 2, values: { a: 2, b: 20 } },
  { t: 3, values: { a: 3 } },
  { t: 4, values: { a: 4, b: 40 } },
];

describe("plotPointsToCsv", () => {
  it("exports header and rows", () => {
    const csv = plotPointsToCsv({ points, channels: ["a", "b"] });
    expect(csv).toContain("index,t,a,b");
    expect(csv).toContain("0,1,1,10");
    expect(csv).toContain("2,3,3,");
  });
});

describe("slicePlotWindow", () => {
  it("returns latest window by default", () => {
    expect(slicePlotWindow(points, 2, 0).map((p) => p.t)).toEqual([3, 4]);
  });

  it("pans from end", () => {
    expect(slicePlotWindow(points, 2, 1).map((p) => p.t)).toEqual([2, 3]);
  });

  it("clamps oversize window", () => {
    expect(slicePlotWindow(points, 100, 0)).toHaveLength(4);
  });
});

describe("clampPlotterZoom", () => {
  it("clamps range", () => {
    expect(clampPlotterZoom(5)).toBe(20);
    expect(clampPlotterZoom(999)).toBe(400);
    expect(clampPlotterZoom(80)).toBe(80);
  });
});
