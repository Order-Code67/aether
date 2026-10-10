import { describe, expect, it } from "vitest";
import { isConditionTruthy, normalizeWatchExpression } from "./debugWatch";

describe("isConditionTruthy", () => {
  it("treats common false values as false", () => {
    expect(isConditionTruthy("0")).toBe(false);
    expect(isConditionTruthy("false")).toBe(false);
    expect(isConditionTruthy("0x0")).toBe(false);
    expect(isConditionTruthy("")).toBe(false);
    expect(isConditionTruthy(null)).toBe(false);
    expect(isConditionTruthy("0.0")).toBe(false);
  });

  it("treats non-zero as true", () => {
    expect(isConditionTruthy("1")).toBe(true);
    expect(isConditionTruthy("true")).toBe(true);
    expect(isConditionTruthy("42")).toBe(true);
    expect(isConditionTruthy('"ok"')).toBe(true);
  });
});

describe("normalizeWatchExpression", () => {
  it("trims", () => {
    expect(normalizeWatchExpression("  foo  ")).toBe("foo");
  });
});
