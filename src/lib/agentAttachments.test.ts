import { describe, expect, it } from "vitest";
import {
  attachmentDisplaySuffix,
  budgetAttachments,
  classifyAttachmentName,
  extensionOf,
  MAX_ATTACHMENT_TOTAL_CHARS,
  packAttachmentsBlock,
  truncateAttachmentText,
} from "./agentAttachments";

describe("extensionOf / classifyAttachmentName", () => {
  it("classifies common code and text extensions", () => {
    expect(extensionOf("src/main.cpp")).toBe("cpp");
    expect(classifyAttachmentName("foo.ino")).toBe("text");
    expect(classifyAttachmentName("notes.MD")).toBe("text");
    expect(classifyAttachmentName("platformio.ini")).toBe("text");
  });

  it("classifies images separately", () => {
    expect(classifyAttachmentName("shot.PNG")).toBe("image");
    expect(classifyAttachmentName("a.webp")).toBe("image");
  });

  it("rejects unsupported binaries", () => {
    expect(classifyAttachmentName("fw.bin")).toBe("unsupported");
    expect(classifyAttachmentName("lib.a")).toBe("unsupported");
  });
});

describe("truncateAttachmentText", () => {
  it("leaves short text alone", () => {
    expect(truncateAttachmentText("hello", 10)).toEqual({
      text: "hello",
      truncated: false,
    });
  });

  it("truncates long text with marker", () => {
    const r = truncateAttachmentText("a".repeat(40), 20);
    expect(r.truncated).toBe(true);
    expect(r.text.length).toBeLessThanOrEqual(20);
    expect(r.text).toContain("truncated");
  });

  it("hard-slices when budget is smaller than the marker", () => {
    const r = truncateAttachmentText("abcdefghij", 5);
    expect(r.truncated).toBe(true);
    expect(r.text).toBe("abcde");
  });
});

describe("budgetAttachments + packAttachmentsBlock", () => {
  it("packs multiple files and respects total budget", () => {
    const packed = budgetAttachments(
      [
        { name: "a.c", content: "AAAA".repeat(20) },
        { name: "b.h", content: "BBBB".repeat(20) },
      ],
      40,
      30,
    );
    expect(packed.length).toBeGreaterThanOrEqual(1);
    expect(packed[0]?.name).toBe("a.c");
    const total = packed.reduce((n, a) => n + a.content.length, 0);
    expect(total).toBeLessThanOrEqual(40);

    const block = packAttachmentsBlock(packed);
    expect(block).toContain("Attached file: a.c");
    expect(block).toContain("```");
  });

  it("default budget is under ~200KB", () => {
    expect(MAX_ATTACHMENT_TOTAL_CHARS).toBeLessThanOrEqual(200_000);
    expect(MAX_ATTACHMENT_TOTAL_CHARS).toBeGreaterThanOrEqual(100_000);
  });

  it("display suffix lists names", () => {
    expect(attachmentDisplaySuffix([{ name: "a.c" }, { name: "b.h" }])).toBe(
      "\n\n[a.c, b.h]",
    );
    expect(attachmentDisplaySuffix([])).toBe("");
  });
});
