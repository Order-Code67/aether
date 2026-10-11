import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  defaultOsdLayout,
  formatOsdCliExport,
  type OsdElement,
  type OsdElementId,
} from "@/core/protocols/msp/osd";

interface OsdState {
  elements: OsdElement[];
  selected: OsdElementId | null;
  setSelected: (id: OsdElementId | null) => void;
  move: (id: OsdElementId, x: number, y: number) => void;
  toggleVisible: (id: OsdElementId) => void;
  reset: () => void;
  exportCli: () => string;
}

export const useOsdStore = create<OsdState>()(
  persist(
    (set, get) => ({
      elements: defaultOsdLayout(),
      selected: null,
      setSelected: (selected) => set({ selected }),
      move: (id, x, y) =>
        set((s) => ({
          elements: s.elements.map((el) =>
            el.id === id ? { ...el, x, y } : el,
          ),
        })),
      toggleVisible: (id) =>
        set((s) => ({
          elements: s.elements.map((el) =>
            el.id === id ? { ...el, visible: !el.visible } : el,
          ),
        })),
      reset: () => set({ elements: defaultOsdLayout(), selected: null }),
      exportCli: () => formatOsdCliExport(get().elements),
    }),
    { name: "aether-osd-layout" },
  ),
);
