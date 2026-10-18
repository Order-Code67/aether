import type { GeoPosition, NedPosition } from "./types";

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const EARTH_RADIUS_M = 6_378_137;

/** Convert local NED offset from an anchor into WGS84 lat/lon/alt. */
export function nedToGeo(anchor: GeoPosition, ned: NedPosition): GeoPosition {
  const lat0 = anchor.lat * DEG2RAD;
  const dLat = ned.northM / EARTH_RADIUS_M;
  const dLon = ned.eastM / (EARTH_RADIUS_M * Math.cos(lat0));
  return {
    lat: anchor.lat + dLat * RAD2DEG,
    lon: anchor.lon + dLon * RAD2DEG,
    altM: anchor.altM - ned.downM,
  };
}

/** Convert WGS84 delta into local NED meters relative to anchor. */
export function geoToNed(anchor: GeoPosition, point: GeoPosition): NedPosition {
  const lat0 = anchor.lat * DEG2RAD;
  const dLat = (point.lat - anchor.lat) * DEG2RAD;
  const dLon = (point.lon - anchor.lon) * DEG2RAD;
  return {
    northM: dLat * EARTH_RADIUS_M,
    eastM: dLon * EARTH_RADIUS_M * Math.cos(lat0),
    downM: anchor.altM - point.altM,
  };
}

/** Horizontal great-circle distance between two WGS84 points (meters). */
export function haversineM(a: GeoPosition, b: GeoPosition): number {
  const φ1 = a.lat * DEG2RAD;
  const φ2 = b.lat * DEG2RAD;
  const Δφ = (b.lat - a.lat) * DEG2RAD;
  const Δλ = (b.lon - a.lon) * DEG2RAD;
  const s =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function formatLatLon(lat: number, lon: number, digits = 6): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(digits)}°${ns} ${Math.abs(lon).toFixed(digits)}°${ew}`;
}

/** Home / return-to-start metrics from local NED (anchor = home). */
export interface HomeMetrics {
  /** Horizontal distance to home meters. */
  distanceM: number;
  /** Course from vehicle toward home, 0° = North, clockwise. */
  bearingToHomeDeg: number;
  /** Course from home toward vehicle (where you are from start). */
  bearingFromHomeDeg: number;
  /**
   * Turn angle to face home: bearingToHome − heading, −180…+180
   * (positive = turn right / clockwise).
   */
  relativeBearingDeg: number;
}

export function homeMetricsFromNed(
  ned: Pick<NedPosition, "northM" | "eastM">,
  headingDeg = 0,
): HomeMetrics {
  const distanceM = Math.hypot(ned.northM, ned.eastM);
  const bearingFromHomeDeg =
    distanceM < 1e-6
      ? 0
      : (((Math.atan2(ned.eastM, ned.northM) * RAD2DEG) % 360) + 360) % 360;
  const bearingToHomeDeg = (bearingFromHomeDeg + 180) % 360;
  let relativeBearingDeg = bearingToHomeDeg - (((headingDeg % 360) + 360) % 360);
  if (relativeBearingDeg > 180) relativeBearingDeg -= 360;
  if (relativeBearingDeg < -180) relativeBearingDeg += 360;
  return {
    distanceM,
    bearingToHomeDeg,
    bearingFromHomeDeg,
    relativeBearingDeg,
  };
}

export function formatHomeArrow(relativeBearingDeg: number): string {
  const a = relativeBearingDeg;
  if (Math.abs(a) < 15) return "↑";
  if (a >= 15 && a < 75) return "↗";
  if (a >= 75 && a < 105) return "→";
  if (a >= 105 && a < 165) return "↘";
  if (Math.abs(a) >= 165) return "↓";
  if (a <= -15 && a > -75) return "↖";
  if (a <= -75 && a > -105) return "←";
  return "↙";
}
