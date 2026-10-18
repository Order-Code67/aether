/** Local North-East-Down displacement from the geo anchor (meters). */
export interface NedPosition {
  northM: number;
  eastM: number;
  downM: number;
}

export interface GeoPosition {
  /** WGS84 latitude degrees. */
  lat: number;
  /** WGS84 longitude degrees. */
  lon: number;
  /** Altitude above anchor / AGL meters (positive up). */
  altM: number;
}

export interface OpticalFlowResult {
  /** Mean horizontal displacement in pixels (right = +). */
  dxPx: number;
  /** Mean vertical displacement in pixels (down = + in image). */
  dyPx: number;
  /** Fraction of blocks that passed the match threshold (0–1). */
  quality: number;
  /** RMS match residual (lower is better). */
  residual: number;
  /** Number of blocks that contributed. */
  inliers: number;
}

export interface VelocityNed {
  /** North velocity m/s. */
  vn: number;
  /** East velocity m/s. */
  ve: number;
  /** Down velocity m/s (usually ~0 without rangefinder delta). */
  vd: number;
}

export interface OpticalNavEstimate {
  ned: NedPosition;
  geo: GeoPosition | null;
  velocity: VelocityNed;
  flow: OpticalFlowResult;
  /** Horizontal position uncertainty estimate (1σ meters, grows with drift). */
  sigmaXYM: number;
  timestampMs: number;
  /** True when altitude/FOV/heading inputs are usable. */
  scaled: boolean;
  /** Distance / bearing back to NED origin (geo anchor or takeoff zero). */
  home: {
    distanceM: number;
    bearingToHomeDeg: number;
    bearingFromHomeDeg: number;
    relativeBearingDeg: number;
  };
}

export interface OpticalNavConfig {
  /** Camera horizontal field of view in degrees. */
  fovHDeg: number;
  /** Altitude above ground meters (positive). Required for metric scale. */
  altitudeM: number;
  /** Vehicle yaw / heading degrees (0 = North, clockwise). */
  headingDeg: number;
  /** Optional geo anchor (last known GPS or surveyed point). */
  anchor: GeoPosition | null;
  /** Downscale longest side for flow (performance). */
  processMaxSide: number;
  /** Block size in pixels on the processed image. */
  blockSize: number;
  /** Search radius in pixels for block matching. */
  searchRadius: number;
  /** Minimum texture variance inside a block to use it. */
  minBlockVariance: number;
}

export const DEFAULT_OPTICAL_NAV_CONFIG: OpticalNavConfig = {
  fovHDeg: 66,
  altitudeM: 10,
  headingDeg: 0,
  anchor: null,
  processMaxSide: 160,
  blockSize: 8,
  searchRadius: 6,
  minBlockVariance: 40,
};

export interface GrayFrame {
  width: number;
  height: number;
  /** Length = width * height, values 0–255. */
  data: Float32Array;
  timestampMs: number;
}
