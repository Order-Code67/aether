import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  OpticalNavEngine,
  buildVisionPositionEstimateFrame,
  formatHomeArrow,
  formatLatLon,
  formatOpticalNavTelemetryLine,
  type OpticalNavEstimate,
} from "@/lib/opticalNav";
import {
  collectFcNavHints,
  type FcNavHintSource,
} from "@/lib/opticalNav/telemetryBridge";
import { isMspPollActive } from "@/lib/mspStatusPoll";
import { useCameraStore } from "@/stores/cameraStore";
import { useInavStore } from "@/stores/inavStore";
import { usePlotterStore } from "@/stores/plotterStore";
import { useSerialStore } from "@/stores/serialStore";

interface OpticalNavState {
  enabled: boolean;
  altitudeM: number;
  fovHDeg: number;
  headingDeg: number;
  anchorLat: string;
  anchorLon: string;
  anchorAltM: number;
  hasAnchor: boolean;
  /** Pull AGL / yaw (and optional GPS) from MAVLink HUD or MSP snapshot. */
  syncFromFc: boolean;
  /** Write MAVLink VISION_POSITION_ESTIMATE to the open COM port. */
  injectVision: boolean;
  /** Append OPTNAV dist/brg lines into the Serial Monitor panel. */
  logToSerial: boolean;
  estimate: OpticalNavEstimate | null;
  lastError: string | null;
  lastTelemetryLine: string | null;
  lastFcSource: FcNavHintSource | null;
  processing: boolean;
  framesProcessed: number;
  injectCount: number;
  lastInjectError: string | null;

  setEnabled: (v: boolean) => void;
  setAltitudeM: (v: number) => void;
  setFovHDeg: (v: number) => void;
  setHeadingDeg: (v: number) => void;
  setAnchorLat: (v: string) => void;
  setAnchorLon: (v: string) => void;
  setAnchorAltM: (v: number) => void;
  setSyncFromFc: (v: boolean) => void;
  setInjectVision: (v: boolean) => void;
  setLogToSerial: (v: boolean) => void;
  applyAnchor: () => boolean;
  /** Copy lat/lon/alt from current FC GPS into the geo anchor fields and apply. */
  applyAnchorFromFc: () => boolean;
  clearAnchor: () => void;
  resetPose: () => void;
  /** Apply FC altitude/heading into store + engine (no-op if sync off). */
  pullFcHints: () => FcNavHintSource | null;
  /** Feed camera frame URL (cache-busted capture). */
  processFrameUrl: (url: string) => Promise<OpticalNavEstimate | null>;
  syncEngineConfig: () => void;
}

let engine: OpticalNavEngine | null = null;
let visionSeq = 0;

function getEngine(): OpticalNavEngine {
  if (!engine) {
    engine = new OpticalNavEngine();
  }
  return engine;
}

function parseCoord(raw: string): number | null {
  const n = Number(String(raw).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

async function injectVisionFrame(
  estimate: OpticalNavEstimate,
  headingDeg: number,
): Promise<void> {
  if (isMspPollActive()) {
    throw new Error("MSP_POLL_BUSY");
  }
  const serial = useSerialStore.getState();
  if (!serial.connected) {
    throw new Error("SERIAL_NOT_CONNECTED");
  }
  const frame = buildVisionPositionEstimateFrame(estimate, {
    headingDeg,
    seq: visionSeq++ & 0xff,
    sysid: 1,
    compid: 197,
  });
  await serial.sendBytes(frame);
}

export const useOpticalNavStore = create<OpticalNavState>()(
  persist(
    (set, get) => ({
      enabled: false,
      altitudeM: 10,
      fovHDeg: 66,
      headingDeg: 0,
      anchorLat: "",
      anchorLon: "",
      anchorAltM: 10,
      hasAnchor: false,
      syncFromFc: true,
      injectVision: false,
      logToSerial: true,
      estimate: null,
      lastError: null,
      lastTelemetryLine: null,
      lastFcSource: null,
      processing: false,
      framesProcessed: 0,
      injectCount: 0,
      lastInjectError: null,

      setEnabled: (v) => {
        if (!v) {
          getEngine().reset(false);
        } else if (useCameraStore.getState().refreshMs <= 0) {
          useCameraStore.getState().setRefreshMs(1000);
        }
        set({ enabled: v, lastError: null, lastInjectError: null });
      },

      setAltitudeM: (v) => {
        const altitudeM = Math.max(0.1, v);
        getEngine().setAltitude(altitudeM);
        set({ altitudeM });
      },

      setFovHDeg: (v) => {
        const fovHDeg = Math.max(1, Math.min(170, v));
        getEngine().setFov(fovHDeg);
        set({ fovHDeg });
      },

      setHeadingDeg: (v) => {
        const headingDeg = ((v % 360) + 360) % 360;
        getEngine().setHeading(headingDeg);
        set({ headingDeg });
      },

      setAnchorLat: (v) => set({ anchorLat: v }),
      setAnchorLon: (v) => set({ anchorLon: v }),
      setAnchorAltM: (v) => set({ anchorAltM: v }),
      setSyncFromFc: (v) => set({ syncFromFc: v }),
      setInjectVision: (v) =>
        set({ injectVision: v, lastInjectError: null }),
      setLogToSerial: (v) => set({ logToSerial: v }),

      applyAnchor: () => {
        const lat = parseCoord(get().anchorLat);
        const lon = parseCoord(get().anchorLon);
        if (lat == null || lon == null) return false;
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
        const altM = Math.max(0, get().anchorAltM);
        getEngine().setGeoAnchor({ lat, lon, altM }, true);
        getEngine().setAltitude(Math.max(0.1, altM || get().altitudeM));
        set({
          hasAnchor: true,
          altitudeM: Math.max(0.1, altM || get().altitudeM),
          estimate: null,
          lastError: null,
        });
        return true;
      },

      applyAnchorFromFc: () => {
        const hints = collectFcNavHints({
          mavlink: usePlotterStore.getState().vehicle,
          msp: useInavStore.getState().mspSnapshot,
        });
        if (!hints.gpsFixOk || hints.lat == null || hints.lon == null) {
          return false;
        }
        const altM = hints.altitudeM ?? get().altitudeM;
        set({
          anchorLat: hints.lat.toFixed(7),
          anchorLon: hints.lon.toFixed(7),
          anchorAltM: altM,
          lastFcSource: hints.source,
        });
        return get().applyAnchor();
      },

      clearAnchor: () => {
        getEngine().clearGeoAnchor();
        set({ hasAnchor: false });
      },

      resetPose: () => {
        getEngine().reset(true);
        set({
          estimate: null,
          lastTelemetryLine: null,
          framesProcessed: 0,
          lastError: null,
          lastInjectError: null,
        });
      },

      pullFcHints: () => {
        if (!get().syncFromFc) return null;
        const hints = collectFcNavHints({
          mavlink: usePlotterStore.getState().vehicle,
          msp: useInavStore.getState().mspSnapshot,
        });
        const patch: Partial<OpticalNavState> = {
          lastFcSource: hints.source,
        };
        if (hints.altitudeM != null) {
          const altitudeM = Math.max(0.1, hints.altitudeM);
          getEngine().setAltitude(altitudeM);
          patch.altitudeM = altitudeM;
        }
        if (hints.headingDeg != null) {
          getEngine().setHeading(hints.headingDeg);
          patch.headingDeg = hints.headingDeg;
        }
        set(patch);
        return hints.source;
      },

      syncEngineConfig: () => {
        const s = get();
        const eng = getEngine();
        eng.setAltitude(s.altitudeM);
        eng.setFov(s.fovHDeg);
        eng.setHeading(s.headingDeg);
        if (s.hasAnchor) {
          const lat = parseCoord(s.anchorLat);
          const lon = parseCoord(s.anchorLon);
          if (lat != null && lon != null) {
            eng.setGeoAnchor({ lat, lon, altM: s.anchorAltM }, false);
          }
        }
      },

      processFrameUrl: async (url) => {
        if (!get().enabled || !url) return null;
        if (get().processing) return get().estimate;
        set({ processing: true, lastError: null });
        try {
          get().pullFcHints();
          get().syncEngineConfig();
          const est = await getEngine().pushUrl(url);
          if (est) {
            const line = formatOpticalNavTelemetryLine(est);
            set({
              estimate: est,
              lastTelemetryLine: line,
              framesProcessed: get().framesProcessed + 1,
            });
            if (get().logToSerial) {
              // Local Serial Monitor only — does not write bytes to the COM port
              useSerialStore.getState().appendLine(line);
            }
            if (get().injectVision) {
              try {
                await injectVisionFrame(est, get().headingDeg);
                set({
                  injectCount: get().injectCount + 1,
                  lastInjectError: null,
                });
              } catch (e) {
                const code =
                  e instanceof Error ? e.message : String(e);
                set({ lastInjectError: code });
              }
            }
          }
          return est;
        } catch (e) {
          set({
            lastError: e instanceof Error ? e.message : String(e),
          });
          return null;
        } finally {
          set({ processing: false });
        }
      },
    }),
    {
      name: "aether-optical-nav",
      partialize: (s) => ({
        enabled: s.enabled,
        altitudeM: s.altitudeM,
        fovHDeg: s.fovHDeg,
        headingDeg: s.headingDeg,
        anchorLat: s.anchorLat,
        anchorLon: s.anchorLon,
        anchorAltM: s.anchorAltM,
        hasAnchor: s.hasAnchor,
        syncFromFc: s.syncFromFc,
        injectVision: s.injectVision,
        logToSerial: s.logToSerial,
      }),
    },
  ),
);

export function formatEstimateHud(estimate: OpticalNavEstimate | null): {
  ned: string;
  geo: string;
  vel: string;
  quality: string;
  home: string;
  homeArrow: string;
} {
  if (!estimate) {
    return {
      ned: "—",
      geo: "—",
      vel: "—",
      quality: "—",
      home: "—",
      homeArrow: "·",
    };
  }
  const { ned, geo, velocity, flow, sigmaXYM, home } = estimate;
  const arrow = formatHomeArrow(home.relativeBearingDeg);
  const rel =
    home.relativeBearingDeg >= 0
      ? `+${home.relativeBearingDeg.toFixed(0)}°`
      : `${home.relativeBearingDeg.toFixed(0)}°`;
  return {
    ned: `N ${ned.northM.toFixed(1)} · E ${ned.eastM.toFixed(1)} m (±${sigmaXYM.toFixed(1)})`,
    geo: geo ? formatLatLon(geo.lat, geo.lon) : "no anchor",
    vel: `${Math.hypot(velocity.vn, velocity.ve).toFixed(1)} m/s`,
    quality: `${Math.round(flow.quality * 100)}% · ${flow.inliers} blk`,
    home: `${home.distanceM.toFixed(1)} m · ${home.bearingToHomeDeg.toFixed(0)}° (${rel})`,
    homeArrow: arrow,
  };
}
