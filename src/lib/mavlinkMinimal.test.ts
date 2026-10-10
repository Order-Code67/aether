import { describe, expect, it } from "vitest";
import {
  buildMavlinkV1Frame,
  buildMavlinkV2Frame,
  encodeAttitudePayload,
  encodeHeartbeatPayload,
  mavlinkToPlotSample,
  MavlinkMinimalParser,
  MAVLINK_MSG_ATTITUDE,
  MAVLINK_MSG_HEARTBEAT,
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
