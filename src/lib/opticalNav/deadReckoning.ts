import { homeMetricsFromNed, nedToGeo } from "./geo";
import type {
  GeoPosition,
  NedPosition,
  OpticalFlowResult,
  OpticalNavConfig,
  OpticalNavEstimate,
  VelocityNed,
} from "./types";

const DEG2RAD = Math.PI / 180;

/**
 * Meters per pixel at the ground plane for a nadir camera.
 * Uses horizontal FOV and processed image width.
 */
export function metersPerPixel(
  altitudeM: number,
  fovHDeg: number,
  imageWidthPx: number,
): number {
  if (!(altitudeM > 0) || !(fovHDeg > 0) || !(imageWidthPx > 0)) return 0;
  const half = (fovHDeg * DEG2RAD) / 2;
  const groundWidth = 2 * altitudeM * Math.tan(half);
  return groundWidth / imageWidthPx;
}

/**
 * Image flow (dx right, dy down) → body-frame ground displacement.
 * For a down-facing camera with aircraft +X forward / +Y right:
 *   scene moves opposite to vehicle motion.
 *   vehicle forward (body +X) ≈ −dy in image
 *   vehicle right   (body +Y) ≈ −dx in image
 */
export function flowToBodyMeters(
  flow: OpticalFlowResult,
  mPerPx: number,
): { forwardM: number; rightM: number } {
  return {
    forwardM: -flow.dyPx * mPerPx,
    rightM: -flow.dxPx * mPerPx,
  };
}

/** Body forward/right → NED using heading (0° = North, clockwise). */
export function bodyToNed(
  forwardM: number,
  rightM: number,
  headingDeg: number,
): Pick<NedPosition, "northM" | "eastM"> {
  const yaw = headingDeg * DEG2RAD;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return {
    northM: forwardM * c - rightM * s,
    eastM: forwardM * s + rightM * c,
  };
}

export interface DeadReckoningState {
  ned: NedPosition;
  /** Accumulated process noise for σ_xy (meters²). */
  varianceXY: number;
  lastTimestampMs: number | null;
}

export function createDeadReckoningState(): DeadReckoningState {
  return {
    ned: { northM: 0, eastM: 0, downM: 0 },
    varianceXY: 0.25,
    lastTimestampMs: null,
  };
}

export function resetDeadReckoning(
  state: DeadReckoningState,
  ned?: Partial<NedPosition>,
): void {
  state.ned = {
    northM: ned?.northM ?? 0,
    eastM: ned?.eastM ?? 0,
    downM: ned?.downM ?? 0,
  };
  state.varianceXY = 0.25;
  state.lastTimestampMs = null;
}

/**
 * Integrate one optical-flow sample into NED dead reckoning.
 * Drift model: σ grows with path length and drops with flow quality.
 */
export function integrateFlowStep(
  state: DeadReckoningState,
  flow: OpticalFlowResult,
  config: OpticalNavConfig,
  imageWidthPx: number,
  timestampMs: number,
): OpticalNavEstimate {
  const dtSec =
    state.lastTimestampMs != null
      ? Math.max(1e-3, (timestampMs - state.lastTimestampMs) / 1000)
      : 0.05;

  const mPerPx = metersPerPixel(
    config.altitudeM,
    config.fovHDeg,
    imageWidthPx,
  );
  const scaled = mPerPx > 0 && flow.quality > 0.05 && flow.inliers >= 2;

  let dN = 0;
  let dE = 0;
  if (scaled) {
    const body = flowToBodyMeters(flow, mPerPx);
    const ned = bodyToNed(body.forwardM, body.rightM, config.headingDeg);
    dN = ned.northM;
    dE = ned.eastM;
    state.ned.northM += dN;
    state.ned.eastM += dE;
    state.ned.downM = -config.altitudeM;

    const stepM = Math.hypot(dN, dE);
    // ~2–8% of step as process noise, worse when quality is low
    const q = Math.max(0.05, Math.min(1, flow.quality));
    state.varianceXY += (stepM * (0.04 + 0.12 * (1 - q))) ** 2;
  }

  state.lastTimestampMs = timestampMs;

  const velocity: VelocityNed = {
    vn: dtSec > 0 ? dN / dtSec : 0,
    ve: dtSec > 0 ? dE / dtSec : 0,
    vd: 0,
  };

  const geo: GeoPosition | null = config.anchor
    ? nedToGeo(config.anchor, state.ned)
    : null;

  const home = homeMetricsFromNed(state.ned, config.headingDeg);

  return {
    ned: { ...state.ned },
    geo,
    velocity,
    flow,
    sigmaXYM: Math.sqrt(Math.max(0, state.varianceXY)),
    timestampMs,
    scaled,
    home,
  };
}

/** Set geo anchor and optionally zero local NED at that point. */
export function setAnchor(
  config: OpticalNavConfig,
  anchor: GeoPosition,
  state: DeadReckoningState,
  zeroNed = true,
): void {
  config.anchor = { ...anchor };
  if (zeroNed) {
    resetDeadReckoning(state, {
      northM: 0,
      eastM: 0,
      downM: -anchor.altM,
    });
  }
}
