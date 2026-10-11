import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CraftKind } from "@/core/plugins/types";

interface CraftState {
  kind: CraftKind;
  label: string;
  setCraft: (kind: CraftKind, label?: string) => void;
}

const LABELS: Record<CraftKind, string> = {
  multirotor: "Multirotor",
  plane: "Airplane",
  vtol: "VTOL",
  rover: "Rover",
  boat: "Boat",
  sub: "Sub",
  unknown: "Unknown",
};

export const useCraftStore = create<CraftState>()(
  persist(
    (set) => ({
      kind: "multirotor",
      label: LABELS.multirotor,
      setCraft: (kind, label) =>
        set({ kind, label: label ?? LABELS[kind] ?? kind }),
    }),
    { name: "aether-craft" },
  ),
);

export const CRAFT_OPTIONS: { kind: CraftKind; label: string }[] = [
  { kind: "multirotor", label: LABELS.multirotor },
  { kind: "plane", label: LABELS.plane },
  { kind: "vtol", label: LABELS.vtol },
  { kind: "rover", label: LABELS.rover },
  { kind: "boat", label: LABELS.boat },
  { kind: "sub", label: LABELS.sub },
];
