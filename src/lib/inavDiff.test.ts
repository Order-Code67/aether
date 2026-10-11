import { describe, expect, it } from "vitest";
import {
  looksLikeCliDiff,
  normalizeCliText,
  splitDiffForCliSend,
  suggestDiffFileStem,
} from "./inavDiff";

describe("inavDiff", () => {
  it("normalizes CRLF", () => {
    expect(normalizeCliText("a\r\nb\rc")).toBe("a\nb\nc");
  });

  it("splits sendable CLI lines and drops comments/blanks", () => {
    const text = `# version\n\nset gyro_lpf = OFF\r\n# note\nfeature RX_SERIAL\n`;
    expect(splitDiffForCliSend(text)).toEqual([
      "set gyro_lpf = OFF",
      "feature RX_SERIAL",
    ]);
  });

  it("detects CLI-ish diffs", () => {
    expect(looksLikeCliDiff("")).toBe(false);
    expect(looksLikeCliDiff("# version\nset foo = 1\n")).toBe(true);
    expect(looksLikeCliDiff("hello world")).toBe(false);
  });

  it("suggests a safe filename stem", () => {
    const stem = suggestDiffFileStem("COM3");
    expect(stem).toMatch(/^inav-diff-COM3-/);
    expect(suggestDiffFileStem("COM/../x")).not.toContain("/");
  });
});
