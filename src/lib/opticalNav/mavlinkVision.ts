import {
  buildMavlinkV1Frame,
  MAVLINK_MSG_VISION_POSITION_ESTIMATE,
} from "@/lib/mavlinkMinimal";
import type { OpticalNavEstimate } from "./types";

export {
  MAVLINK_MSG_VISION_POSITION_ESTIMATE,
} from "@/lib/mavlinkMinimal";

/** CRC_EXTRA from common.xml (documented for callers / tests). */
export const CRC_EXTRA_VISION_POSITION_ESTIMATE = 158;

/**
 * Encode VISION_POSITION_ESTIMATE payload (32-byte core, no covariance).
 * x/y/z are local NED meters; roll/pitch/yaw radians (zeros if unknown).
 */
export function encodeVisionPositionEstimatePayload(opts: {
  usec?: number;
  x: number;
  y: number;
  z: number;
  roll?: number;
  pitch?: number;
  yaw?: number;
}): number[] {
  const buf = new ArrayBuffer(32);
  const view = new DataView(buf);
  // uint64 usec — write as two uint32 LE
  const usec = Math.max(0, Math.floor(opts.usec ?? Date.now() * 1000));
  view.setUint32(0, usec >>> 0, true);
  view.setUint32(4, Math.floor(usec / 0x1_0000_0000) >>> 0, true);
  view.setFloat32(8, opts.x, true);
  view.setFloat32(12, opts.y, true);
  view.setFloat32(16, opts.z, true);
  view.setFloat32(20, opts.roll ?? 0, true);
  view.setFloat32(24, opts.pitch ?? 0, true);
  view.setFloat32(28, opts.yaw ?? 0, true);
  return Array.from(new Uint8Array(buf));
}

/** Map Aether optical-nav estimate → VISION_POSITION_ESTIMATE fields. */
export function estimateToVisionPayload(
  estimate: OpticalNavEstimate,
  headingDeg = 0,
): number[] {
  const yaw = (headingDeg * Math.PI) / 180;
  return encodeVisionPositionEstimatePayload({
    usec: estimate.timestampMs * 1000,
    x: estimate.ned.northM,
    y: estimate.ned.eastM,
    z: estimate.ned.downM,
    yaw,
  });
}

/** Build a MAVLink v1 VISION_POSITION_ESTIMATE frame from an estimate. */
export function buildVisionPositionEstimateFrame(
  estimate: OpticalNavEstimate,
  opts?: {
    sysid?: number;
    compid?: number;
    seq?: number;
    headingDeg?: number;
  },
): Uint8Array {
  const payload = estimateToVisionPayload(estimate, opts?.headingDeg ?? 0);
  return buildMavlinkV1Frame(
    MAVLINK_MSG_VISION_POSITION_ESTIMATE,
    opts?.sysid ?? 1,
    opts?.compid ?? 197,
    payload,
    opts?.seq ?? 0,
  );
}

/** Human-readable line for Serial Monitor / logging. */
export function formatOpticalNavTelemetryLine(
  estimate: OpticalNavEstimate,
): string {
  const { ned, geo, velocity, flow, sigmaXYM, scaled, home } = estimate;
  const parts = [
    "OPTNAV",
    `N=${ned.northM.toFixed(2)}`,
    `E=${ned.eastM.toFixed(2)}`,
    `D=${ned.downM.toFixed(2)}`,
    `dist=${home.distanceM.toFixed(1)}`,
    `brg=${home.bearingToHomeDeg.toFixed(0)}`,
    `rel=${home.relativeBearingDeg.toFixed(0)}`,
    `vn=${velocity.vn.toFixed(2)}`,
    `ve=${velocity.ve.toFixed(2)}`,
    `q=${flow.quality.toFixed(2)}`,
    `sig=${sigmaXYM.toFixed(1)}`,
    scaled ? "scaled" : "unscaled",
  ];
  if (geo) {
    parts.push(`lat=${geo.lat.toFixed(7)}`, `lon=${geo.lon.toFixed(7)}`);
  }
  return parts.join(" ");
}
