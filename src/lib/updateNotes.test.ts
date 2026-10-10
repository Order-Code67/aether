import { describe, expect, it } from "vitest";
import { localizeUpdateNotes } from "./updateNotes";

describe("localizeUpdateNotes", () => {
  it("returns Russian mapped notes for known versions", () => {
    const notes = localizeUpdateNotes("0.2.7", "English feed body", "ru");
    expect(notes).toContain("Стабильность фокуса");
    expect(notes).not.toContain("English feed body");
  });

  it("prefers feed body for English", () => {
    expect(localizeUpdateNotes("0.2.7", "Feed notes", "en")).toBe("Feed notes");
  });
});
