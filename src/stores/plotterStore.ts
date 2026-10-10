import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  MavlinkMinimalParser,
  mavlinkToPlotSample,
  type MavlinkHeartbeat,
} from "@/lib/mavlinkMinimal";
import {
  clampPlotterZoom,
  PLOTTER_ZOOM_MAX,
} from "@/lib/plotterExport";
import { parseSerialPlotLine } from "@/lib/serialPlotter";

const MAX_POINTS = 400;

export type PlotterParseMode = "text" | "mavlink";

export interface PlotPoint {
  t: number;
  values: Record<string, number>;
}

export interface TelemetryVehicleInfo {
  vehicleType: string;
  armed: boolean;
  autopilot: number;
  systemStatus: number;
}

interface PlotterState {
  paused: boolean;
  parseMode: PlotterParseMode;
  points: PlotPoint[];
  channels: string[];
  /** Channel id → visible */
  visibility: Record<string, boolean>;
  seq: number;
  vehicle: TelemetryVehicleInfo | null;
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

function appendSample(
  state: Pick<PlotterState, "points" | "channels" | "visibility" | "seq">,
  sample: Record<string, number>,
): Pick<PlotterState, "points" | "channels" | "visibility" | "seq"> {
  const channels = [...state.channels];
  const visibility = { ...state.visibility };
  for (const key of Object.keys(sample)) {
    if (!channels.includes(key)) {
      channels.push(key);
      if (visibility[key] === undefined) visibility[key] = true;
    }
  }
  const next: PlotPoint = {
    t: state.seq + 1,
    values: sample,
  };
  const points = [...state.points, next];
  return {
    seq: next.t,
    channels,
    visibility,
    points:
      points.length > MAX_POINTS
        ? points.slice(points.length - MAX_POINTS)
        : points,
  };
}

function vehicleFromHeartbeat(hb: MavlinkHeartbeat): TelemetryVehicleInfo {
  return {
    vehicleType: hb.vehicleType,
    armed: hb.armed,
    autopilot: hb.autopilot,
    systemStatus: hb.systemStatus,
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
            if (result.kind === "heartbeat") {
              next = {
                ...next,
                vehicle: vehicleFromHeartbeat(result.data),
              };
              continue;
            }
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
