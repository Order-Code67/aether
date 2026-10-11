import { describe, expect, it } from "vitest";
import {
  applyMspFrameToSnapshot,
  crc8DvbS2,
  emptySnapshot,
  encodeMspRequest,
  encodeMspV1,
  encodeMspV2,
  MspMinimalParser,
  MSP_ANALOG,
  MSP_API_VERSION,
  MSP_FC_VARIANT,
  MSP_FC_VERSION,
  MSP_NAME,
  MSP_RAW_GPS,
  MSP_STATUS,
  MSP_STATUS_EX,
  mspGpsFixLabel,
  parseAnalog,
  parseApiVersion,
  parseFcVariant,
  parseFcVersion,
  parseName,
  parseRawGps,
  parseStatus,
  sensorsPresentLabels,
} from "./mspMinimal";

function u16le(n: number): number[] {
  return [n & 0xff, (n >> 8) & 0xff];
}

function u32le(n: number): number[] {
  return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];
}

function i32le(n: number): number[] {
  return u32le(n >>> 0);
}

describe("MSP encode/decode", () => {
  it("encodes MSP v1 request with xor checksum", () => {
    const frame = encodeMspV1(MSP_API_VERSION);
    expect(Array.from(frame)).toEqual([
      0x24,
      0x4d,
      0x3c,
      0x00,
      MSP_API_VERSION,
      MSP_API_VERSION ^ 0x00,
    ]);
  });

  it("round-trips MSP v1 response via parser", () => {
    const payload = [1, 2, 5]; // protocol, major, minor
    const req = encodeMspV1(MSP_API_VERSION, payload, "from_fc");
    const parser = new MspMinimalParser();
    const frames = parser.push(req);
    expect(frames).toHaveLength(1);
    expect(frames[0]!.cmd).toBe(MSP_API_VERSION);
    expect(frames[0]!.version).toBe(1);
    expect(parseApiVersion(frames[0]!.payload)).toEqual({
      protocolVersion: 1,
      apiMajor: 2,
      apiMinor: 5,
    });
  });

  it("encodes and parses MSP v2 with crc8", () => {
    const payload = [0x49, 0x4e, 0x41, 0x56]; // INAV
    const frame = encodeMspV2(MSP_FC_VARIANT, payload, "from_fc");
    // Verify CRC matches body
    const crcBody = frame.subarray(3, frame.length - 1);
    expect(frame[frame.length - 1]).toBe(crc8DvbS2(crcBody));

    const parser = new MspMinimalParser();
    const frames = parser.push(frame);
    expect(frames).toHaveLength(1);
    expect(frames[0]!.version).toBe(2);
    expect(parseFcVariant(frames[0]!.payload)).toBe("INAV");
  });

  it("parses FC version and name", () => {
    expect(parseFcVersion(new Uint8Array([7, 1, 0]))).toEqual({
      major: 7,
      minor: 1,
      patch: 0,
    });
    expect(parseName(new Uint8Array([0x51, 0x75, 0x61, 0x64, 0x00]))).toBe(
      "Quad",
    );
  });

  it("parses STATUS with armed / sensors / cycle time", () => {
    const payload = new Uint8Array([
      ...u16le(3500), // cycle
      ...u16le(0), // i2c
      ...u16le(0b100101), // acc + mag + gyro bits 0,2,5
      ...u32le(0x01), // armed
      0, // currentSet
      ...u16le(42), // cpuLoad (STATUS_EX)
    ]);
    const st = parseStatus(payload);
    expect(st).not.toBeNull();
    expect(st!.cycleTime).toBe(3500);
    expect(st!.armed).toBe(true);
    expect(st!.cpuLoad).toBe(42);
    expect(sensorsPresentLabels(st!.sensors)).toEqual(["acc", "mag", "gyro"]);
  });

  it("parses ANALOG voltage and mAh", () => {
    const payload = new Uint8Array([
      126, // 12.6 V
      ...u16le(850),
      ...u16le(100),
      ...u16le(150), // 1.50 A
    ]);
    const a = parseAnalog(payload);
    expect(a!.voltage).toBeCloseTo(12.6, 3);
    expect(a!.mAhDrawn).toBe(850);
    expect(a!.amperage).toBeCloseTo(1.5, 3);
  });

  it("parses RAW_GPS lat/lon/sats", () => {
    const lat = Math.round(55.75 * 1e7);
    const lon = Math.round(37.61 * 1e7);
    const payload = new Uint8Array([
      3, // 3D fix
      12,
      ...i32le(lat),
      ...i32le(lon),
      ...u16le(120),
      ...u16le(550), // 5.5 m/s
      ...u16le(900), // 90.0 deg
    ]);
    const g = parseRawGps(payload);
    expect(g!.fix).toBe(3);
    expect(g!.numSat).toBe(12);
    expect(g!.lat).toBeCloseTo(55.75, 5);
    expect(g!.lon).toBeCloseTo(37.61, 5);
    expect(mspGpsFixLabel(g!.fix)).toBe("3d");
  });

  it("rejects bad v1 checksum", () => {
    const good = encodeMspV1(MSP_API_VERSION, [1, 2, 3], "from_fc");
    const bad = new Uint8Array(good);
    const last = bad.length - 1;
    bad[last] = (bad[last] ?? 0) ^ 0xff;
    const parser = new MspMinimalParser();
    expect(parser.push(bad)).toHaveLength(0);
  });

  it("builds status snapshot from polled frames", () => {
    let snap = emptySnapshot(0);
    const frames = [
      encodeMspV1(MSP_API_VERSION, [1, 2, 1], "from_fc"),
      encodeMspV1(MSP_FC_VARIANT, [0x49, 0x4e, 0x41, 0x56], "from_fc"),
      encodeMspV1(MSP_FC_VERSION, [7, 1, 2], "from_fc"),
      encodeMspV1(MSP_NAME, [0x41, 0x31], "from_fc"),
      encodeMspV1(
        MSP_STATUS_EX,
        [
          ...u16le(2000),
          ...u16le(0),
          ...u16le(1),
          ...u32le(0),
          0,
          ...u16le(10),
        ],
        "from_fc",
      ),
      encodeMspV1(
        MSP_ANALOG,
        [110, ...u16le(10), ...u16le(0), ...u16le(0)],
        "from_fc",
      ),
      encodeMspV1(
        MSP_RAW_GPS,
        [
          0,
          0,
          ...i32le(0),
          ...i32le(0),
          ...u16le(0),
          ...u16le(0),
          ...u16le(0),
        ],
        "from_fc",
      ),
    ];
    const parser = new MspMinimalParser();
    for (const f of frames) {
      for (const parsed of parser.push(f)) {
        snap = applyMspFrameToSnapshot(snap, parsed);
      }
    }
    expect(snap.isInav).toBe(true);
    expect(snap.fcVariant).toBe("INAV");
    expect(snap.fcVersion).toEqual({ major: 7, minor: 1, patch: 2 });
    expect(snap.name).toBe("A1");
    expect(snap.status?.cycleTime).toBe(2000);
    expect(snap.analog?.voltage).toBeCloseTo(11.0, 3);
    expect(snap.gps?.numSat).toBe(0);
  });

  it("warns non-INAV via isInav=false but keeps version", () => {
    let snap = emptySnapshot(0);
    const parser = new MspMinimalParser();
    for (const f of parser.push(
      encodeMspV1(MSP_FC_VARIANT, [0x42, 0x54, 0x46, 0x4c], "from_fc"),
    )) {
      snap = applyMspFrameToSnapshot(snap, f);
    }
    for (const f of parser.push(
      encodeMspV1(MSP_FC_VERSION, [4, 5, 0], "from_fc"),
    )) {
      snap = applyMspFrameToSnapshot(snap, f);
    }
    expect(snap.isInav).toBe(false);
    expect(snap.fcVariant).toBe("BTFL");
    expect(snap.fcVersion?.major).toBe(4);
  });

  it("encodeMspRequest uses v1 for classic cmds", () => {
    const f = encodeMspRequest(MSP_STATUS);
    expect(f[1]).toBe(0x4d);
  });
});
