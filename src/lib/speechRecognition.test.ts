import { describe, expect, it } from "vitest";
import {
  resolveVoiceInputMode,
  speechLocale,
  whisperLanguage,
} from "./speechRecognition";

describe("speechLocale", () => {
  it("maps app locale to BCP-47 speech tags", () => {
    expect(speechLocale("ru")).toBe("ru-RU");
    expect(speechLocale("en")).toBe("en-US");
  });
});

describe("whisperLanguage", () => {
  it("maps app locale to ISO-639-1", () => {
    expect(whisperLanguage("ru")).toBe("ru");
    expect(whisperLanguage("en")).toBe("en");
  });
});

describe("resolveVoiceInputMode", () => {
  it("returns null when neither Web Speech nor MediaRecorder exist", () => {
    // In jsdom/vitest both are typically absent.
    expect(resolveVoiceInputMode(true)).toBeNull();
    expect(resolveVoiceInputMode(false)).toBeNull();
  });
});
