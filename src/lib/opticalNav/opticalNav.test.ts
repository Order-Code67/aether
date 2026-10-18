import { describe, expect, it } from "vitest";
import {
  bodyToNed,
  buildVisionPositionEstimateFrame,
  collectFcNavHints,
  createDeadReckoningState,
  flowToBodyMeters,
  formatOpticalNavTelemetryLine,
  geoToNed,
  haversineM,
  homeMetricsFromNed,
  integrateFlowStep,
  metersPerPixel,
  nedToGeo,
  OpticalNavEngine,
  estimateOpticalFlow,
  rgbaToGray,
  type GrayFrame,
  type OpticalFlowResult,
} from "./index";
import {
  MavlinkMinimalParser,
  MAVLINK_MSG_VISION_POSITION_ESTIMATE,
} from "@/lib/mavlinkMinimal";

function makeShiftedFrame(
  width: number,
  height: number,
  dx: number,
  dy: number,
  timestampMs: number,
): GrayFrame {
  // Checker / gradient texture so block matching has features
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = x - dx;
      const sy = y - dy;
      const v =
        ((Math.sin(sx * 0.35) + 1) * 60 + (Math.cos(sy * 0.28) + 1) * 40) +
        ((sx ^ sy) & 7) * 3;
      data[y * width + x] = v;
    }
  }
  return { width, height, data, timestampMs };
}

describe("geo / NED", () => {
  it("round-trips NED offsets near equator", () => {
    const anchor = { lat: 0, lon: 0, altM: 50 };
    const ned = { northM: 100, eastM: -50, downM: -50 };
    const geo = nedToGeo(anchor, ned);
    const back = geoToNed(anchor, geo);
    expect(back.northM).toBeCloseTo(100, 1);
    expect(back.eastM).toBeCloseTo(-50, 1);
    expect(back.downM).toBeCloseTo(-50, 5);
  });

  it("haversine is ~0 for identical points", () => {
    const p = { lat: 55.75, lon: 37.61, altM: 0 };
    expect(haversineM(p, p)).toBeLessThan(0.01);
  });

  it("home metrics: east of home, heading north → turn left toward home", () => {
    const h = homeMetricsFromNed({ northM: 0, eastM: 100 }, 0);
    expect(h.distanceM).toBeCloseTo(100, 5);
    expect(h.bearingFromHomeDeg).toBeCloseTo(90, 5);
    expect(h.bearingToHomeDeg).toBeCloseTo(270, 5);
    expect(h.relativeBearingDeg).toBeCloseTo(-90, 5);
  });
});

describe("metersPerPixel / body→NED", () => {
  it("scales with altitude", () => {
    const low = metersPerPixel(5, 90, 160);
    const high = metersPerPixel(10, 90, 160);
    expect(high).toBeCloseTo(low * 2, 5);
  });

  it("heading 0: forward → north", () => {
    const ned = bodyToNed(2, 0, 0);
    expect(ned.northM).toBeCloseTo(2, 5);
    expect(ned.eastM).toBeCloseTo(0, 5);
  });

  it("heading 90: forward → east", () => {
    const ned = bodyToNed(2, 0, 90);
    expect(ned.northM).toBeCloseTo(0, 5);
    expect(ned.eastM).toBeCloseTo(2, 5);
  });

  it("flow image-down maps to body forward", () => {
    const flow: OpticalFlowResult = {
      dxPx: 0,
      dyPx: 4,
      quality: 1,
      residual: 1,
      inliers: 10,
    };
    const body = flowToBodyMeters(flow, 0.5);
    expect(body.forwardM).toBeCloseTo(-2, 5);
    expect(body.rightM).toBeCloseTo(0, 5);
  });
});

describe("optical flow block matching", () => {
  it("recovers a known integer shift", () => {
    const prev = makeShiftedFrame(96, 72, 0, 0, 0);
    const curr = makeShiftedFrame(96, 72, 3, -2, 40);
    const flow = estimateOpticalFlow(prev, curr, {
      blockSize: 8,
      searchRadius: 5,
      minBlockVariance: 10,
    });
    expect(flow.inliers).toBeGreaterThan(4);
    expect(flow.dxPx).toBeCloseTo(3, 0);
    expect(flow.dyPx).toBeCloseTo(-2, 0);
    expect(flow.quality).toBeGreaterThan(0.2);
  });

  it("rgbaToGray produces expected size and BT.601 luma", () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]);
    const g = rgbaToGray(rgba, 2, 1);
    expect(g.data.length).toBe(2);
    // R luma 0.299*255 < G luma 0.587*255
    expect(g.data[1]!).toBeGreaterThan(g.data[0]!);
  });
});

describe("dead reckoning + engine", () => {
  it("integrates displacement and sets geo from anchor", () => {
    const state = createDeadReckoningState();
    const flow: OpticalFlowResult = {
      dxPx: 0,
      dyPx: -8, // image up → vehicle forward
      quality: 0.8,
      residual: 2,
      inliers: 20,
    };
    const est = integrateFlowStep(
      state,
      flow,
      {
        fovHDeg: 90,
        altitudeM: 10,
        headingDeg: 0,
        anchor: { lat: 55.0, lon: 37.0, altM: 10 },
        processMaxSide: 160,
        blockSize: 8,
        searchRadius: 6,
        minBlockVariance: 40,
      },
      160,
      1000,
    );
    expect(est.scaled).toBe(true);
    expect(est.ned.northM).toBeGreaterThan(0);
    expect(est.geo).not.toBeNull();
    expect(est.geo!.lat).toBeGreaterThan(55);
    expect(est.home.distanceM).toBeGreaterThan(0);
    // Flew north → home is south → bearing ~180
    expect(est.home.bearingToHomeDeg).toBeGreaterThan(135);
    expect(est.home.bearingToHomeDeg).toBeLessThan(225);
  });

  it("OpticalNavEngine accumulates pose across frames", () => {
    const eng = new OpticalNavEngine({
      altitudeM: 8,
      fovHDeg: 66,
      headingDeg: 0,
      processMaxSide: 96,
      minBlockVariance: 10,
    });
    eng.setGeoAnchor({ lat: 50, lon: 30, altM: 8 });
    expect(eng.pushGray(makeShiftedFrame(96, 72, 0, 0, 0))).toBeNull();
    const e1 = eng.pushGray(makeShiftedFrame(96, 72, 2, 0, 50));
    expect(e1).not.toBeNull();
    expect(e1!.flow.inliers).toBeGreaterThan(0);
    const line = formatOpticalNavTelemetryLine(e1!);
    expect(line).toContain("OPTNAV");
    expect(line).toContain("lat=");
  });
});

describe("collectFcNavHints", () => {
  it("prefers MAVLink relative altitude and fills heading from MSP", () => {
    const hints = collectFcNavHints({
      mavlink: {
        alt: 120,
        relativeAlt: 15,
        heading: null,
        lat: 55.1,
        lon: 37.2,
        fixType: 3,
      },
      msp: {
        apiVersion: null,
        fcVariant: "INAV",
        fcVersion: null,
        name: null,
        status: null,
        analog: null,
        gps: {
          fix: 3,
          numSat: 10,
          lat: 55.0,
          lon: 37.0,
          alt: 40,
          speed: 0,
          groundCourse: 90,
        },
        isInav: true,
        updatedAt: 1,
      },
    });
    expect(hints.altitudeM).toBe(15);
    expect(hints.headingDeg).toBe(90);
    expect(hints.lat).toBeCloseTo(55.1, 5);
    expect(hints.source).toBe("mixed");
    expect(hints.gpsFixOk).toBe(true);
  });

  it("uses MSP alone when MAVLink HUD empty", () => {
    const hints = collectFcNavHints({
      mavlink: null,
      msp: {
        apiVersion: null,
        fcVariant: "INAV",
        fcVersion: null,
        name: null,
        status: null,
        analog: null,
        gps: {
          fix: 2,
          numSat: 6,
          lat: 50,
          lon: 30,
          alt: 22,
          speed: 1,
          groundCourse: 180,
        },
        isInav: true,
        updatedAt: 1,
      },
    });
    expect(hints.source).toBe("msp");
    expect(hints.altitudeM).toBe(22);
    expect(hints.headingDeg).toBe(180);
  });
});

describe("MAVLink VISION_POSITION_ESTIMATE", () => {
  it("builds a CRC-valid v1 frame", () => {
    const eng = new OpticalNavEngine({ altitudeM: 5, minBlockVariance: 10 });
    eng.pushGray(makeShiftedFrame(64, 48, 0, 0, 0));
    const est = eng.pushGray(makeShiftedFrame(64, 48, 1, 1, 40));
    expect(est).not.toBeNull();
    const frame = buildVisionPositionEstimateFrame(est!, { headingDeg: 45 });
    expect(frame[0]).toBe(0xfe);
    expect(frame[5]).toBe(MAVLINK_MSG_VISION_POSITION_ESTIMATE);
    const parser = new MavlinkMinimalParser();
    const results = parser.push(frame);
    expect(results).toHaveLength(1);
    expect(results[0]!.kind).toBe("other");
    expect(results[0]!.frame.msgid).toBe(MAVLINK_MSG_VISION_POSITION_ESTIMATE);
    expect(results[0]!.frame.payload.length).toBe(32);
  });
});
