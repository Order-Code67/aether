import { describe, expect, it } from "vitest";
import { isGithubLibSpec, parseGithubLibSpec } from "./githubLibSpec";

describe("parseGithubLibSpec", () => {
  it("normalizes owner/repo", () => {
    expect(parseGithubLibSpec("PaulStoffregen/OneWire")).toEqual({
      ok: true,
      spec: "https://github.com/PaulStoffregen/OneWire.git",
      label: "PaulStoffregen/OneWire",
    });
  });

  it("accepts #branch and .git on short form", () => {
    expect(parseGithubLibSpec("owner/repo.git#develop")).toEqual({
      ok: true,
      spec: "https://github.com/owner/repo.git#develop",
      label: "owner/repo#develop",
    });
  });

  it("accepts full https URL", () => {
    expect(
      parseGithubLibSpec("https://github.com/PaulStoffregen/OneWire.git"),
    ).toEqual({
      ok: true,
      spec: "https://github.com/PaulStoffregen/OneWire.git",
      label: "PaulStoffregen/OneWire",
    });
  });

  it("accepts URL with branch fragment", () => {
    expect(
      parseGithubLibSpec("https://github.com/owner/repo#feature/x"),
    ).toEqual({
      ok: true,
      spec: "https://github.com/owner/repo.git#feature/x",
      label: "owner/repo#feature/x",
    });
  });

  it("rejects empty and bad schemes", () => {
    expect(parseGithubLibSpec("")).toEqual({ ok: false, error: "empty" });
    expect(parseGithubLibSpec("http://github.com/a/b").ok).toBe(false);
    expect(parseGithubLibSpec("file:///tmp/x").ok).toBe(false);
    expect(parseGithubLibSpec("not a repo").ok).toBe(false);
  });
});

describe("isGithubLibSpec", () => {
  it("detects likely github inputs", () => {
    expect(isGithubLibSpec("a/b")).toBe(true);
    expect(isGithubLibSpec("https://github.com/a/b")).toBe(true);
    expect(isGithubLibSpec("ArduinoJson")).toBe(false);
  });
});
