import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  applyXtermStdinEnabled,
  cssAllowsEditableUserSelect,
  shouldMonacoClaimFocus,
  terminalFocusOptions,
} from "./focusPolicy";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("cssAllowsEditableUserSelect", () => {
  it("accepts Aether index.css contract", () => {
    const css = readFileSync(path.join(rootDir, "src/styles/index.css"), "utf8");
    const result = cssAllowsEditableUserSelect(css);
    expect(result.reasons).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("rejects body user-select:none", () => {
    const bad = `
      body { user-select: none; color: #ccc; }
      input { user-select: text; }
      .monaco-editor { user-select: text; }
      .xterm { user-select: text; }
    `;
    expect(cssAllowsEditableUserSelect(bad).ok).toBe(false);
  });
});

describe("terminalFocusOptions", () => {
  it("disables stdin when inactive", () => {
    expect(terminalFocusOptions(false)).toEqual({ disableStdin: true });
    expect(terminalFocusOptions(true)).toEqual({ disableStdin: false });
  });
});

describe("applyXtermStdinEnabled", () => {
  it("makes helper textarea non-focusable when disabled", () => {
    const host = document.createElement("div");
    const ta = document.createElement("textarea");
    ta.className = "xterm-helper-textarea";
    host.appendChild(ta);
    document.body.appendChild(host);

    applyXtermStdinEnabled(host, false);
    expect(ta.readOnly).toBe(true);
    expect(ta.tabIndex).toBe(-1);

    applyXtermStdinEnabled(host, true);
    expect(ta.readOnly).toBe(false);
    expect(ta.tabIndex).toBe(0);

    host.remove();
  });

  it("no-ops when host has no helper textarea", () => {
    expect(() => applyXtermStdinEnabled(null, false)).not.toThrow();
    expect(() =>
      applyXtermStdinEnabled(document.createElement("div"), false),
    ).not.toThrow();
  });
});

describe("shouldMonacoClaimFocus", () => {
  it("yields to search / terminal / inputs", () => {
    const search = document.createElement("div");
    search.setAttribute("data-aether-focus-surface", "search");
    const input = document.createElement("input");
    search.appendChild(input);
    document.body.appendChild(search);
    expect(shouldMonacoClaimFocus(input)).toBe(false);

    const term = document.createElement("div");
    term.className = "xterm";
    const ta = document.createElement("textarea");
    term.appendChild(ta);
    document.body.appendChild(term);
    expect(shouldMonacoClaimFocus(ta)).toBe(false);

    search.remove();
    term.remove();
  });

  it("claims focus when body / monaco is active", () => {
    expect(shouldMonacoClaimFocus(document.body)).toBe(true);
    const monaco = document.createElement("div");
    monaco.className = "monaco-editor";
    const area = document.createElement("textarea");
    monaco.appendChild(area);
    document.body.appendChild(monaco);
    expect(shouldMonacoClaimFocus(area)).toBe(true);
    monaco.remove();
  });
});
