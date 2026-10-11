import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  emptyWaypoint,
  formatMissionCli,
  type Mission,
  type Waypoint,
  type WaypointAction,
} from "@/core/protocols/mission/types";

interface MissionState {
  mission: Mission;
  selectedId: number | null;
  addWaypoint: () => void;
  removeWaypoint: (id: number) => void;
  updateWaypoint: (id: number, patch: Partial<Waypoint>) => void;
  setSelected: (id: number | null) => void;
  rename: (name: string) => void;
  exportCli: () => string;
  clear: () => void;
}

function newMission(): Mission {
  return {
    id: crypto.randomUUID(),
    name: "Mission 1",
    craft: "multirotor",
    waypoints: [
      { ...emptyWaypoint(1), lat: 55.75, lon: 37.61, alt: 40 },
      { ...emptyWaypoint(2), lat: 55.751, lon: 37.615, alt: 40 },
      { ...emptyWaypoint(3), action: "rth" as WaypointAction, lat: 0, lon: 0, alt: 0 },
    ],
    updatedAt: Date.now(),
  };
}

export const useMissionStore = create<MissionState>()(
  persist(
    (set, get) => ({
      mission: newMission(),
      selectedId: 1,
      addWaypoint: () =>
        set((s) => {
          const id =
            s.mission.waypoints.reduce((m, w) => Math.max(m, w.id), 0) + 1;
          return {
            mission: {
              ...s.mission,
              waypoints: [...s.mission.waypoints, emptyWaypoint(id)],
              updatedAt: Date.now(),
            },
            selectedId: id,
          };
        }),
      removeWaypoint: (id) =>
        set((s) => ({
          mission: {
            ...s.mission,
            waypoints: s.mission.waypoints.filter((w) => w.id !== id),
            updatedAt: Date.now(),
          },
        })),
      updateWaypoint: (id, patch) =>
        set((s) => ({
          mission: {
            ...s.mission,
            waypoints: s.mission.waypoints.map((w) =>
              w.id === id ? { ...w, ...patch } : w,
            ),
            updatedAt: Date.now(),
          },
        })),
      setSelected: (selectedId) => set({ selectedId }),
      rename: (name) =>
        set((s) => ({
          mission: { ...s.mission, name, updatedAt: Date.now() },
        })),
      exportCli: () => formatMissionCli(get().mission),
      clear: () => set({ mission: newMission(), selectedId: 1 }),
    }),
    { name: "aether-mission" },
  ),
);
