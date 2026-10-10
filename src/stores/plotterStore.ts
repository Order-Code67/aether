import { create } from "zustand";
import { persist } from "zustand/middleware";
import { parseSerialPlotLine } from "@/lib/serialPlotter";

const MAX_POINTS = 400;

export interface PlotPoint {
  t: number;
  values: Record<string, number>;
}

interface PlotterState {
  paused: boolean;
  points: PlotPoint[];
  channels: string[];
  /** Channel id → visible */
  visibility: Record<string, boolean>;
  seq: number;
  setPaused: (paused: boolean) => void;
  toggleChannel: (channel: string) => void;
  clear: () => void;
  ingestLine: (line: string) => void;
}

export const usePlotterStore = create<PlotterState>()(
  persist(
    (set, get) => ({
      paused: false,
      points: [],
      channels: [],
      visibility: {},
      seq: 0,

      setPaused: (paused) => set({ paused }),

      toggleChannel: (channel) =>
        set((state) => ({
          visibility: {
            ...state.visibility,
            [channel]: !(state.visibility[channel] ?? true),
          },
        })),

      clear: () => set({ points: [], channels: [], visibility: {}, seq: 0 }),

      ingestLine: (line) => {
        if (get().paused) return;
        const sample = parseSerialPlotLine(line);
        if (!sample) return;

        set((state) => {
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
        });
      },
    }),
    {
      name: "aether-plotter",
      partialize: (state) => ({
        paused: state.paused,
        visibility: state.visibility,
      }),
    },
  ),
);
