import {
  createDeadReckoningState,
  integrateFlowStep,
  resetDeadReckoning,
  setAnchor,
  type DeadReckoningState,
} from "./deadReckoning";
import { decodeImageToGray, estimateOpticalFlow } from "./opticalFlow";
import {
  DEFAULT_OPTICAL_NAV_CONFIG,
  type GeoPosition,
  type GrayFrame,
  type OpticalNavConfig,
  type OpticalNavEstimate,
} from "./types";

/**
 * Stateful optical navigation: JPEG/Blob frames → NED + optional WGS84.
 * Runs entirely on the companion PC (Aether); not a flight-controller substitute.
 */
export class OpticalNavEngine {
  readonly config: OpticalNavConfig;
  private readonly state: DeadReckoningState;
  private prev: GrayFrame | null = null;
  private lastEstimate: OpticalNavEstimate | null = null;

  constructor(config: Partial<OpticalNavConfig> = {}) {
    this.config = { ...DEFAULT_OPTICAL_NAV_CONFIG, ...config };
    this.state = createDeadReckoningState();
  }

  get estimate(): OpticalNavEstimate | null {
    return this.lastEstimate;
  }

  get ned() {
    return { ...this.state.ned };
  }

  reset(zeroPose = true): void {
    this.prev = null;
    this.lastEstimate = null;
    if (zeroPose) {
      resetDeadReckoning(this.state);
    } else {
      this.state.lastTimestampMs = null;
    }
  }

  setAltitude(m: number): void {
    this.config.altitudeM = Math.max(0.1, m);
  }

  setHeading(deg: number): void {
    this.config.headingDeg = ((deg % 360) + 360) % 360;
  }

  setFov(deg: number): void {
    this.config.fovHDeg = Math.max(1, Math.min(170, deg));
  }

  setGeoAnchor(anchor: GeoPosition, zeroNed = true): void {
    setAnchor(this.config, anchor, this.state, zeroNed);
  }

  clearGeoAnchor(): void {
    this.config.anchor = null;
  }

  /** Push a pre-decoded gray frame (useful in tests). */
  pushGray(frame: GrayFrame): OpticalNavEstimate | null {
    if (!this.prev) {
      this.prev = frame;
      return null;
    }
    const flow = estimateOpticalFlow(this.prev, frame, this.config);
    const estimate = integrateFlowStep(
      this.state,
      flow,
      this.config,
      frame.width,
      frame.timestampMs,
    );
    this.prev = frame;
    this.lastEstimate = estimate;
    return estimate;
  }

  /** Decode JPEG/PNG bytes and integrate. */
  async pushImageBytes(
    bytes: Uint8Array,
    timestampMs = Date.now(),
  ): Promise<OpticalNavEstimate | null> {
    const copy = new Uint8Array(bytes);
    const blob = new Blob([copy], { type: "image/jpeg" });
    const gray = await decodeImageToGray(
      blob,
      this.config.processMaxSide,
      timestampMs,
    );
    return this.pushGray(gray);
  }

  /** Fetch a camera URL (Tauri / local network) and integrate. */
  async pushUrl(
    url: string,
    timestampMs = Date.now(),
  ): Promise<OpticalNavEstimate | null> {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    return this.pushImageBytes(buf, timestampMs);
  }
}
