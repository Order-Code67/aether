import { describe, expect, it } from "vitest";
import { parsePortBaudArgs } from "./cliHandoff";

describe("parsePortBaudArgs", () => {
  it("parses long flags", () => {
    expect(
      parsePortBaudArgs(["bpla-studio.exe", "--port", "COM7", "--baud", "115200"]),
    ).toEqual({ port: "COM7", baud: 115200 });
  });

  it("parses equals form", () => {
    expect(parsePortBaudArgs(["--port=COM3", "--baud=57600"])).toEqual({
      port: "COM3",
      baud: 57600,
    });
  });
});
