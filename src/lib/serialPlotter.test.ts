import { describe, expect, it } from "vitest";
import { parseSerialPlotLine } from "./serialPlotter";

describe("parseSerialPlotLine", () => {
  it("parses key:value pairs", () => {
    expect(parseSerialPlotLine("temp:23.5 humidity:40")).toEqual({
      temp: 23.5,
      humidity: 40,
    });
  });

  it("parses key=value pairs", () => {
    expect(parseSerialPlotLine("value=12")).toEqual({ value: 12 });
  });

  it("parses CSV numbers as chN", () => {
    expect(parseSerialPlotLine("23.5,40.1")).toEqual({
      ch0: 23.5,
      ch1: 40.1,
    });
  });

  it("parses a single bare number as value", () => {
    expect(parseSerialPlotLine("42")).toEqual({ value: 42 });
  });

  it("ignores non-numeric lines", () => {
    expect(parseSerialPlotLine("hello world")).toBeNull();
    expect(parseSerialPlotLine("")).toBeNull();
  });

  it("handles scientific notation", () => {
    expect(parseSerialPlotLine("adc:1.2e-3")).toEqual({ adc: 0.0012 });
  });
});
