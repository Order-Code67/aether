import { describe, expect, it } from "vitest";
import { speechLocale } from "./speechRecognition";

describe("speechLocale", () => {
  it("maps app locale to BCP-47 speech tags", () => {
    expect(speechLocale("ru")).toBe("ru-RU");
    expect(speechLocale("en")).toBe("en-US");
  });
});
