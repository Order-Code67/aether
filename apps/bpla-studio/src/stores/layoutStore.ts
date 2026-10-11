import { create } from "zustand";

/** Minimal stub — studio has no IDE bottom panel; plotter opens are no-ops. */
interface LayoutState {
  setBottomPanelVisible: (v: boolean) => void;
  setBottomPanelTab: (tab: string) => void;
}

export const useLayoutStore = create<LayoutState>()(() => ({
  setBottomPanelVisible: () => {},
  setBottomPanelTab: () => {},
}));
