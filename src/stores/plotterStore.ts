import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  MavlinkMinimalParser,
  mavlinkToPlotSample,
  type MavlinkHeartbeat,
  type MavlinkParseResult,
} from "@/lib/mavlinkMinimal";
import {
  clampPlotterZoom,
  PLOTTER_ZOOM_MAX,
} from "@/lib/plotterExport";
import {
  orderPlotChannels,
  parseSerialPlotLine,
  sampleHasRadioChannels,
} from "@/lib/serialPlotter";

const MAX_POINTS = 400;

export type PlotterParseMode = "text" | "mavlink";

export interface PlotPoint {
  t: number;
  values: Record<string, number>;
}

/** Live MAVLink HUD snapshot (not a full GCS). */
export interface TelemetryHud {
  vehicleType: string;
  armed: boolean;
  autopilot: number;
  systemStatus: number;
  customMode: number;
  lat: number | null;
  lon: number | null;
  alt: number | null;
  fixType: number | null;
  satellites: number | null;
  voltage: number | null;
  current: number | null;
  batteryRemaining: number | null;
  groundspeed: number | null;
  airspeed: number | null;
  heading: number | null;
  throttle: number | null;
}

/** @deprecated Prefer TelemetryHud — kept for callers that only need vehicle bits. */
export type TelemetryVehicleInfo = Pick<
  TelemetryHud,
  "vehicleType" | "armed" | "autopilot" | "systemStatus"
>;

interface PlotterState {
  paused: boolean;
  parseMode: PlotterParseMode;
  points: PlotPoint[];
  channels: string[];
  /** Channel id → visible */
  visibility: Record<string, boolean>;
  seq: number;
  /** Full HUD; null until first HEARTBEAT (or clear). */
  vehicle: TelemetryHud | null;
  /** Visible sample count (horizontal zoom). */
  zoomSamples: number;
  /** Samples scrolled back from the latest point. */
  panFromEnd: number;
  setPaused: (paused: boolean) => void;
  setParseMode: (mode: PlotterParseMode) => void;
  toggleChannel: (channel: string) => void;
  clear: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setPanFromEnd: (pan: number) => void;
  nudgePan: (delta: number) => void;
  ingestLine: (line: string) => void;
  ingestBytes: (bytes: ArrayLike<number>) => void;
}

const mavParser = new MavlinkMinimalParser();

function emptyHudFromHeartbeat(hb: MavlinkHeartbeat): TelemetryHud {
  return {
    vehicleType: hb.vehicleType,
    armed: hb.armed,
    autopilot: hb.autopilot,
    systemStatus: hb.systemStatus,
    customMode: hb.customMode,
    lat: null,
    lon: null,
    alt: null,
    fixType: null,
    satellites: null,
    voltage: null,
    current: null,
    batteryRemaining: null,
    groundspeed: null,
    airspeed: null,
    heading: null,
    throttle: null,
  };
}

function applyResultToHud(
  prev: TelemetryHud | null,
  result: MavlinkParseResult,
): TelemetryHud | null {
  if (result.kind === "heartbeat") {
    const base = prev ?? emptyHudFromHeartbeat(result.data);
    return {
      ...base,
      vehicleType: result.data.vehicleType,
      armed: result.data.armed,
      autopilot: result.data.autopilot,
      systemStatus: result.data.systemStatus,
      customMode: result.data.customMode,
    };
  }
  // Allow HUD updates before HEARTBEAT so GPS/batt still show
  const hud: TelemetryHud = prev ?? {
    vehicleType: "generic",
    armed: false,
    autopilot: 0,
    systemStatus: 0,
    customMode: 0,
    lat: null,
    lon: null,
    alt: null,
    fixType: null,
    satellites: null,
    voltage: null,
    current: null,
    batteryRemaining: null,
    groundspeed: null,
    airspeed: null,
    heading: null,
    throttle: null,
  };

  if (result.kind === "sys_status") {
    return {
      ...hud,
      voltage: result.data.voltage,
      current: result.data.current,
      batteryRemaining: result.data.batteryRemaining,
    };
  }
  if (result.kind === "battery_status") {
    return {
      ...hud,
      voltage: result.data.voltage ?? hud.voltage,
      current: result.data.current ?? hud.current,
      batteryRemaining:
        result.data.batteryRemaining ?? hud.batteryRemaining,
    };
  }
  if (result.kind === "gps_raw_int") {
    return {
      ...hud,
      lat: result.data.lat,
      lon: result.data.lon,
      alt: result.data.alt,
      fixType: result.data.fixType,
      satellites: result.data.satellitesVisible,
      groundspeed: result.data.vel ?? hud.groundspeed,
    };
  }
  if (result.kind === "global_position_int") {
    return {
      ...hud,
      lat: result.data.lat,
      lon: result.data.lon,
      alt: result.data.alt,
      groundspeed: result.data.groundspeed,
      heading: result.data.hdg ?? hud.heading,
    };
  }
  if (result.kind === "vfr_hud") {
    return {
      ...hud,
      alt: result.data.alt,
      groundspeed: result.data.groundspeed,
      airspeed: result.data.airspeed,
      heading: result.data.heading,
      throttle: result.data.throttle,
    };
  }
  return hud;
}

function appendSample(
  state: Pick<PlotterState, "points" | "channels" | "visibility" | "seq">,
  sample: Record<string, number>,
): Pick<PlotterState, "points" | "channels" | "visibility" | "seq"> {
  const channels = [...state.channels];
  const visibility = { ...state.visibility };
  for (const key of Object.keys(sample)) {
    if (!channels.includes(key)) {
      channels.push(key);
      // Prefer radio channels visible by default
      if (visibility[key] === undefined) visibility[key] = true;
    }
  }
  const next: PlotPoint = {
    t: state.seq + 1,
    values: sample,
  };
  const points = [...state.points, next];
  const ordered = sampleHasRadioChannels(sample)
    ? orderPlotChannels(channels)
    : channels;
  return {
    seq: next.t,
    channels: ordered,
    visibility,
    points:
      points.length > MAX_POINTS
        ? points.slice(points.length - MAX_POINTS)
        : points,
  };
}

export const usePlotterStore = create<PlotterState>()(
  persist(
    (set, get) => ({
      paused: false,
      parseMode: "text",
      points: [],
      channels: [],
      visibility: {},
      seq: 0,
      vehicle: null,
      zoomSamples: PLOTTER_ZOOM_MAX,
      panFromEnd: 0,

      setPaused: (paused) => set({ paused }),

      setParseMode: (mode) => {
        mavParser.reset();
        set({ parseMode: mode, vehicle: mode === "mavlink" ? get().vehicle : null });
      },

      toggleChannel: (channel) =>
        set((state) => ({
          visibility: {
            ...state.visibility,
            [channel]: !(state.visibility[channel] ?? true),
          },
        })),

      clear: () => {
        mavParser.reset();
        set({
          points: [],
          channels: [],
          visibility: {},
          seq: 0,
          vehicle: null,
          panFromEnd: 0,
        });
      },

      zoomIn: () =>
        set((state) => ({
          zoomSamples: clampPlotterZoom(Math.round(state.zoomSamples / 1.4)),
          panFromEnd: Math.min(
            state.panFromEnd,
            Math.max(0, state.points.length - 20),
          ),
        })),

      zoomOut: () =>
        set((state) => ({
          zoomSamples: clampPlotterZoom(Math.round(state.zoomSamples * 1.4)),
        })),

      resetZoom: () => set({ zoomSamples: PLOTTER_ZOOM_MAX, panFromEnd: 0 }),

      setPanFromEnd: (pan) =>
        set((state) => {
          const size = Math.min(state.zoomSamples, state.points.length || 1);
          const maxPan = Math.max(0, state.points.length - size);
          return { panFromEnd: Math.max(0, Math.min(Math.floor(pan), maxPan)) };
        }),

      nudgePan: (delta) => {
        get().setPanFromEnd(get().panFromEnd + delta);
      },

      ingestLine: (line) => {
        if (get().paused) return;
        if (get().parseMode !== "text") return;
        const sample = parseSerialPlotLine(line);
        if (!sample) return;

        set((state) => appendSample(state, sample));
      },

      ingestBytes: (bytes) => {
        if (get().paused) return;
        if (get().parseMode !== "mavlink") return;

        const results = mavParser.push(bytes);
        if (results.length === 0) return;

        set((state) => {
          let next = {
            points: state.points,
            channels: state.channels,
            visibility: state.visibility,
            seq: state.seq,
            vehicle: state.vehicle,
          };
          for (const result of results) {
            next = {
              ...next,
              vehicle: applyResultToHud(next.vehicle, result),
            };
            const sample = mavlinkToPlotSample(result);
            if (sample) {
              const appended = appendSample(next, sample);
              next = { ...next, ...appended };
            }
          }
          return next;
        });
      },
    }),
    {
      name: "aether-plotter",
      partialize: (state) => ({
        paused: state.paused,
        visibility: state.visibility,
        parseMode: state.parseMode,
        zoomSamples: state.zoomSamples,
      }),
    },
  ),
);
