import { describe, expect, it } from "vitest";
import {
  buildMavlinkV1Frame,
  buildMavlinkV2Frame,
  encodeAttitudePayload,
  encodeBatteryStatusPayload,
  encodeGlobalPositionIntPayload,
  encodeGpsRawIntPayload,
  encodeHeartbeatPayload,
  encodeSysStatusPayload,
  encodeVfrHudPayload,
  gpsFixLabel,
  mavlinkToPlotSample,
  MavlinkMinimalParser,
  MAVLINK_MSG_ATTITUDE,
  MAVLINK_MSG_BATTERY_STATUS,
  MAVLINK_MSG_GLOBAL_POSITION_INT,
  MAVLINK_MSG_GPS_RAW_INT,
  MAVLINK_MSG_HEARTBEAT,
  MAVLINK_MSG_SYS_STATUS,
  MAVLINK_MSG_VFR_HUD,
} from "./mavlinkMinimal";

describe("MavlinkMinimalParser", () => {
  it("parses v1 HEARTBEAT (armed quadrotor)", () => {
    const payload = encodeHeartbeatPayload({
      type: 2,
      baseMode: 0x80,
      autopilot: 3,
    });
    const frame = buildMavlinkV1Frame(MAVLINK_MSG_HEARTBEAT, 1, 1, payload);
    const parser = new MavlinkMinimalParser();
    const results = parser.push(frame);
    expect(results).toHaveLength(1);
    const r = results[0]!;
    expect(r.kind).toBe("heartbeat");
    if (r.kind !== "heartbeat") return;
    expect(r.data.vehicleType).toBe("quadrotor");
    expect(r.data.armed).toBe(true);
    expect(r.frame.version).toBe(1);
  });

  it("parses v2 ATTITUDE and yields degrees for plot", () => {
    const roll = 0.1;
    const pitch = -0.2;
    const yaw = 1.0;
    const payload = encodeAttitudePayload({ roll, pitch, yaw });
    const frame = buildMavlinkV2Frame(MAVLINK_MSG_ATTITUDE, 1, 1, payload);
    const parser = new MavlinkMinimalParser();
    const results = parser.push(frame);
    expect(results).toHaveLength(1);
    const r = results[0]!;
    expect(r.kind).toBe("attitude");
    const sample = mavlinkToPlotSample(r);
    expect(sample).not.toBeNull();
    expect(sample!.roll).toBeCloseTo((roll * 180) / Math.PI, 3);
    expect(sample!.pitch).toBeCloseTo((pitch * 180) / Math.PI, 3);
    expect(sample!.yaw).toBeCloseTo((yaw * 180) / Math.PI, 3);
  });

  it("parses SYS_STATUS battery voltage / current / remaining", () => {
    const payload = encodeSysStatusPayload({
      voltageMv: 12600,
      currentCA: 150,
      batteryRemaining: 72,
    });
    const frame = buildMavlinkV1Frame(MAVLINK_MSG_SYS_STATUS, 1, 1, payload);
    const parser = new MavlinkMinimalParser();
    const results = parser.push(frame);
    expect(results).toHaveLength(1);
    const r = results[0]!;
    expect(r.kind).toBe("sys_status");
    if (r.kind !== "sys_status") return;
    expect(r.data.voltage).toBeCloseTo(12.6, 3);
    expect(r.data.current).toBeCloseTo(1.5, 3);
    expect(r.data.batteryRemaining).toBe(72);
    const sample = mavlinkToPlotSample(r);
    expect(sample?.battery).toBe(72);
    expect(sample?.voltage).toBeCloseTo(12.6, 3);
  });

  it("parses GPS_RAW_INT lat/lon/alt/fix/sats", () => {
    const payload = encodeGpsRawIntPayload({
      fixType: 3,
      latE7: 557551234,
      lonE7: 376174321,
      altMm: 150500,
      velCm: 1250,
      satellites: 12,
    });
    const frame = buildMavlinkV1Frame(MAVLINK_MSG_GPS_RAW_INT, 1, 1, payload);
    const parser = new MavlinkMinimalParser();
    const results = parser.push(frame);
    expect(results).toHaveLength(1);
    const r = results[0]!;
    expect(r.kind).toBe("gps_raw_int");
    if (r.kind !== "gps_raw_int") return;
    expect(r.data.fixType).toBe(3);
    expect(r.data.lat).toBeCloseTo(55.7551234, 5);
    expect(r.data.lon).toBeCloseTo(37.6174321, 5);
    expect(r.data.alt).toBeCloseTo(150.5, 3);
    expect(r.data.vel).toBeCloseTo(12.5, 3);
    expect(r.data.satellitesVisible).toBe(12);
    expect(gpsFixLabel(r.data.fixType)).toBe("3D");
    const sample = mavlinkToPlotSample(r);
    expect(sample?.alt).toBeCloseTo(150.5, 3);
    expect(sample?.speed).toBeCloseTo(12.5, 3);
  });

  it("parses GLOBAL_POSITION_INT position and groundspeed", () => {
    const payload = encodeGlobalPositionIntPayload({
      latE7: 400000000,
      lonE7: -740000000,
      altMm: 10000,
      relativeAltMm: 5000,
      vxCms: 300,
      vyCms: 400,
      hdgCdeg: 9000,
    });
    const frame = buildMavlinkV2Frame(
      MAVLINK_MSG_GLOBAL_POSITION_INT,
      1,
      1,
      payload,
    );
    const parser = new MavlinkMinimalParser();
    const results = parser.push(frame);
    expect(results).toHaveLength(1);
    const r = results[0]!;
    expect(r.kind).toBe("global_position_int");
    if (r.kind !== "global_position_int") return;
    expect(r.data.lat).toBeCloseTo(40, 5);
    expect(r.data.lon).toBeCloseTo(-74, 5);
    expect(r.data.alt).toBeCloseTo(10, 3);
    expect(r.data.relativeAlt).toBeCloseTo(5, 3);
    expect(r.data.groundspeed).toBeCloseTo(5, 3); // hypot(3,4)
    expect(r.data.hdg).toBeCloseTo(90, 3);
  });

  it("parses VFR_HUD airspeed/groundspeed/heading/throttle/alt", () => {
    const payload = encodeVfrHudPayload({
      airspeed: 12.5,
      groundspeed: 11.0,
      heading: 270,
      throttle: 45,
      alt: 88.25,
      climb: 0.5,
    });
    const frame = buildMavlinkV1Frame(MAVLINK_MSG_VFR_HUD, 1, 1, payload);
    const parser = new MavlinkMinimalParser();
    const results = parser.push(frame);
    expect(results).toHaveLength(1);
    const r = results[0]!;
    expect(r.kind).toBe("vfr_hud");
    if (r.kind !== "vfr_hud") return;
    expect(r.data.airspeed).toBeCloseTo(12.5, 3);
    expect(r.data.groundspeed).toBeCloseTo(11, 3);
    expect(r.data.heading).toBe(270);
    expect(r.data.throttle).toBe(45);
    expect(r.data.alt).toBeCloseTo(88.25, 3);
    const sample = mavlinkToPlotSample(r);
    expect(sample?.speed).toBeCloseTo(11, 3);
    expect(sample?.throttle).toBe(45);
  });

  it("parses BATTERY_STATUS remaining and voltage", () => {
    const payload = encodeBatteryStatusPayload({
      voltageMv: 11100,
      currentCA: 200,
      batteryRemaining: 55,
    });
    const frame = buildMavlinkV2Frame(
      MAVLINK_MSG_BATTERY_STATUS,
      1,
      1,
      payload,
    );
    const parser = new MavlinkMinimalParser();
    const results = parser.push(frame);
    expect(results).toHaveLength(1);
    const r = results[0]!;
    expect(r.kind).toBe("battery_status");
    if (r.kind !== "battery_status") return;
    expect(r.data.voltage).toBeCloseTo(11.1, 3);
    expect(r.data.current).toBeCloseTo(2, 3);
    expect(r.data.batteryRemaining).toBe(55);
  });

  it("resyncs after garbage bytes", () => {
    const payload = encodeHeartbeatPayload({ type: 1, baseMode: 0 });
    const frame = buildMavlinkV1Frame(MAVLINK_MSG_HEARTBEAT, 1, 1, payload);
    const stream = new Uint8Array([0xaa, 0xbb, 0xfe, 0x99, ...frame]);
    const parser = new MavlinkMinimalParser();
    const results = parser.push(stream);
    expect(results.some((r) => r.kind === "heartbeat")).toBe(true);
  });

  it("handles split frames across pushes", () => {
    const payload = encodeHeartbeatPayload({ type: 10 });
    const frame = buildMavlinkV1Frame(MAVLINK_MSG_HEARTBEAT, 1, 1, payload);
    const parser = new MavlinkMinimalParser();
    const mid = Math.floor(frame.length / 2);
    expect(parser.push(frame.slice(0, mid))).toHaveLength(0);
    const results = parser.push(frame.slice(mid));
    expect(results).toHaveLength(1);
    const first = results[0];
    expect(first?.kind).toBe("heartbeat");
    if (first?.kind === "heartbeat") {
      expect(first.data.vehicleType).toBe("ground_rover");
    }
  });

  it("rejects bad CRC", () => {
    const payload = encodeHeartbeatPayload({});
    const frame = buildMavlinkV1Frame(MAVLINK_MSG_HEARTBEAT, 1, 1, payload);
    const bad = new Uint8Array(frame);
    const last = bad.length - 1;
    bad[last] = (bad[last] ?? 0) ^ 0xff;
    const parser = new MavlinkMinimalParser();
    expect(parser.push(bad)).toHaveLength(0);
  });
});
