import { describe, expect, it } from "vitest";
import {
  boxNameForPermanentId,
  encodeCfSerialConfig,
  encodeSetModeRange,
  formatCliSerialLine,
  modeRangeToPwm,
  parseBoxIds,
  parseBoxNames,
  parseCfSerialConfig,
  parseCliSerialLines,
  parseModeRanges,
  pwmToModeRangeStep,
  serialFunctionLabels,
  serialIdentifierLabel,
} from "./mspConfig";

describe("mspConfig ports", () => {
  it("parses CF serial config 7-byte records", () => {
    const payload = new Uint8Array([
      0, // id
      1,
      0, // mask MSP
      4,
      4,
      4,
      4, // baud indexes → 115200
    ]);
    const ports = parseCfSerialConfig(payload);
    expect(ports).toHaveLength(1);
    expect(ports![0]!.functionMask).toBe(1);
    expect(ports![0]!.mspBaud).toBe(115200);
  });

  it("round-trips CF serial encode/parse", () => {
    const ports = [
      {
        identifier: 1,
        functionMask: 3,
        mspBaud: 115200,
        gpsBaud: 57600,
        telemetryBaud: 115200,
        blackboxBaud: 115200,
      },
    ];
    const encoded = encodeCfSerialConfig(ports);
    const parsed = parseCfSerialConfig(encoded);
    expect(parsed).toHaveLength(1);
    expect(parsed![0]!.identifier).toBe(1);
    expect(parsed![0]!.functionMask).toBe(3);
    expect(parsed![0]!.mspBaud).toBe(115200);
    expect(parsed![0]!.gpsBaud).toBe(57600);
  });

  it("parses CLI serial lines", () => {
    const text = `
# serial
serial 0 1 115200 115200 115200 115200
serial 1 2 115200 57600 115200 115200
`;
    const ports = parseCliSerialLines(text);
    expect(ports).toHaveLength(2);
    expect(ports[1]!.functionMask).toBe(2);
    expect(formatCliSerialLine(ports[0]!)).toBe(
      "serial 0 1 115200 115200 115200 115200",
    );
  });

  it("labels functions and identifiers", () => {
    expect(serialFunctionLabels(1)).toEqual(["MSP"]);
    expect(serialFunctionLabels(0)).toEqual(["NONE"]);
    expect(serialIdentifierLabel(0)).toBe("USB_VCP");
    expect(serialIdentifierLabel(1)).toBe("UART1");
  });
});

describe("mspConfig modes", () => {
  it("parses BOXNAMES and BOXIDS", () => {
    const names = parseBoxNames(
      new Uint8Array([
        ..."ARM".split("").map((c) => c.charCodeAt(0)),
        0,
        ..."ANGLE".split("").map((c) => c.charCodeAt(0)),
        0,
      ]),
    );
    expect(names).toEqual(["ARM", "ANGLE"]);
    expect(parseBoxIds(new Uint8Array([0, 1, 2]))).toEqual([0, 1, 2]);
  });

  it("parses MODE_RANGES and encodes SET_MODE_RANGE", () => {
    const payload = new Uint8Array([0, 0, 4, 48, 1, 1, 16, 32]);
    const ranges = parseModeRanges(payload);
    expect(ranges).toHaveLength(2);
    expect(ranges[0]!.permanentId).toBe(0);
    expect(modeRangeToPwm(ranges[0]!.startStep)).toBe(1000);
    expect(modeRangeToPwm(ranges[0]!.endStep)).toBe(2100);
    expect(pwmToModeRangeStep(1500)).toBe(24);

    const enc = encodeSetModeRange(ranges[1]!);
    expect(Array.from(enc)).toEqual([1, 1, 1, 16, 32]);
  });

  it("resolves box names by permanent id", () => {
    expect(
      boxNameForPermanentId(1, [0, 1, 2], ["ARM", "ANGLE", "HORIZON"]),
    ).toBe("ANGLE");
    expect(boxNameForPermanentId(9, [0], ["ARM"])).toBe("ID 9");
  });
});
