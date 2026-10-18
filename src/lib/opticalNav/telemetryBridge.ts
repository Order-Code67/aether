import type { MspStatusSnapshot } from "@/lib/mspMinimal";

export type FcNavHintSource = "mavlink" | "msp" | "mixed";

/** Minimal MAVLink HUD fields used by optical nav (subset of plotter TelemetryHud). */
export interface MavlinkHudSlice {
  alt: number | null;
  relativeAlt: number | null;
  heading: number | null;
  lat: number | null;
  lon: number | null;
  fixType: number | null;
}

/** Best-effort altitude / heading / GPS from live FC telemetry stores. */
export interface FcNavHints {
  /** Prefer AGL / relative altitude when known. */
  altitudeM: number | null;
  headingDeg: number | null;
  lat: number | null;
  lon: number | null;
  /** Which bus contributed (null if nothing usable). */
  source: FcNavHintSource | null;
  /** True when GPS fix looks usable for a geo anchor. */
  gpsFixOk: boolean;
}

function normalizeHeading(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function positiveAlt(m: number | null | undefined): number | null {
  if (m == null || !Number.isFinite(m) || m <= 0) return null;
  return m;
}

/**
 * Merge MAVLink HUD + MSP status snapshot into optical-nav inputs.
 * MAVLink wins on conflicts (continuous stream); MSP fills gaps.
 */
export function collectFcNavHints(opts: {
  mavlink?: MavlinkHudSlice | null;
  msp?: MspStatusSnapshot | null;
}): FcNavHints {
  const mav = opts.mavlink ?? null;
  const msp = opts.msp ?? null;

  let altitudeM: number | null = null;
  let headingDeg: number | null = null;
  let lat: number | null = null;
  let lon: number | null = null;
  let fromMav = false;
  let fromMsp = false;

  if (mav) {
    const rel = positiveAlt(mav.relativeAlt);
    const abs = positiveAlt(mav.alt);
    if (rel != null) {
      altitudeM = rel;
      fromMav = true;
    } else if (abs != null) {
      altitudeM = abs;
      fromMav = true;
    }
    if (mav.heading != null && Number.isFinite(mav.heading)) {
      headingDeg = normalizeHeading(mav.heading);
      fromMav = true;
    }
    if (
      mav.lat != null &&
      mav.lon != null &&
      Number.isFinite(mav.lat) &&
      Number.isFinite(mav.lon)
    ) {
      lat = mav.lat;
      lon = mav.lon;
      fromMav = true;
    }
  }

  if (msp?.gps) {
    const gps = msp.gps;
    if (altitudeM == null) {
      const a = positiveAlt(gps.alt);
      if (a != null) {
        altitudeM = a;
        fromMsp = true;
      }
    }
    if (headingDeg == null && Number.isFinite(gps.groundCourse)) {
      headingDeg = normalizeHeading(gps.groundCourse);
      fromMsp = true;
    }
    if (lat == null && lon == null && Number.isFinite(gps.lat) && Number.isFinite(gps.lon)) {
      lat = gps.lat;
      lon = gps.lon;
      fromMsp = true;
    }
  }

  const mavFixOk =
    mav != null &&
    mav.fixType != null &&
    mav.fixType >= 2 &&
    mav.lat != null &&
    mav.lon != null;
  const mspFixOk = msp?.gps != null && msp.gps.fix >= 2;

  let source: FcNavHintSource | null = null;
  if (fromMav && fromMsp) source = "mixed";
  else if (fromMav) source = "mavlink";
  else if (fromMsp) source = "msp";

  return {
    altitudeM,
    headingDeg,
    lat,
    lon,
    source,
    gpsFixOk: Boolean(mavFixOk || mspFixOk),
  };
}
