import { describe, expect, it } from "vitest";
import { classifyComDriverIssue } from "./comDrivers";

describe("classifyComDriverIssue", () => {
  it("detects empty ports option", () => {
    expect(classifyComDriverIssue(null, { portsEmpty: true })).toBe(
      "empty_ports",
    );
  });

  it("detects access denied patterns", () => {
    expect(classifyComDriverIssue("Access is denied")).toBe("access_denied");
    expect(
      classifyComDriverIssue("OSError: [Errno 13] Permission denied"),
    ).toBe("access_denied");
    expect(classifyComDriverIssue("Port busy or access denied. Close Serial")).toBe(
      "access_denied",
    );
  });

  it("detects port not found", () => {
    expect(classifyComDriverIssue("Serial port not found. Connect the board")).toBe(
      "port_not_found",
    );
    expect(classifyComDriverIssue("Could not find a port")).toBe("port_not_found");
  });

  it("detects open failures", () => {
    expect(classifyComDriverIssue("Could not open port COM3")).toBe(
      "open_failed",
    );
    expect(
      classifyComDriverIssue("SerialException: could not open serial"),
    ).toBe("open_failed");
  });

  it("returns null for unrelated errors", () => {
    expect(classifyComDriverIssue("No platformio.ini")).toBeNull();
    expect(classifyComDriverIssue("")).toBeNull();
  });
});
