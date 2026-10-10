import { describe, expect, it } from "vitest";
import { vscodeErrorKey } from "./vscodeIntegration";

describe("vscodeErrorKey", () => {
  it("maps missing CLI sentinel", () => {
    expect(vscodeErrorKey(new Error("VSCODE_CLI_MISSING"))).toBe(
      "vscode.cliMissing",
    );
    expect(vscodeErrorKey("VSCODE_CLI_MISSING: code not on PATH")).toBe(
      "vscode.cliMissing",
    );
  });

  it("maps other open failures", () => {
    expect(vscodeErrorKey(new Error("spawn failed"))).toBe("vscode.openFailed");
    expect(vscodeErrorKey("unknown")).toBe("vscode.openFailed");
  });
});
