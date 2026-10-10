import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ActivityId, BottomPanelTab } from "@/types/layout";

export const SIDEBAR_MIN = 180;
export const SIDEBAR_MAX = 560;
export const SIDEBAR_DEFAULT = 260;

export const BOTTOM_MIN = 100;
export const BOTTOM_MAX = 560;
export const BOTTOM_DEFAULT = 220;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface LayoutState {
  activeActivity: ActivityId;
  sidebarVisible: boolean;
  sidebarWidth: number;
  bottomPanelVisible: boolean;
  bottomPanelHeight: number;
  bottomPanelTab: BottomPanelTab;
  setActiveActivity: (id: ActivityId) => void;
  toggleActivity: (id: ActivityId) => void;
  setSidebarVisible: (visible: boolean) => void;
  setSidebarWidth: (width: number) => void;
  resizeSidebarBy: (delta: number) => void;
  resetSidebarWidth: () => void;
  setBottomPanelVisible: (visible: boolean) => void;
  toggleBottomPanel: () => void;
  setBottomPanelHeight: (height: number) => void;
  resizeBottomPanelBy: (delta: number) => void;
  resetBottomPanelHeight: () => void;
  setBottomPanelTab: (tab: BottomPanelTab) => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      activeActivity: "explorer",
      sidebarVisible: true,
      sidebarWidth: SIDEBAR_DEFAULT,
      bottomPanelVisible: true,
      bottomPanelHeight: BOTTOM_DEFAULT,
      bottomPanelTab: "output",

      setActiveActivity: (id) =>
        set({ activeActivity: id, sidebarVisible: true }),

      toggleActivity: (id) => {
        const { activeActivity, sidebarVisible } = get();
        if (activeActivity === id && sidebarVisible) {
          set({ sidebarVisible: false });
          return;
        }
        set({ activeActivity: id, sidebarVisible: true });
      },

      setSidebarVisible: (visible) => set({ sidebarVisible: visible }),

      setSidebarWidth: (width) =>
        set({ sidebarWidth: clamp(width, SIDEBAR_MIN, SIDEBAR_MAX) }),

      resizeSidebarBy: (delta) =>
        set((state) => ({
          sidebarWidth: clamp(
            state.sidebarWidth + delta,
            SIDEBAR_MIN,
            SIDEBAR_MAX,
          ),
        })),

      resetSidebarWidth: () => set({ sidebarWidth: SIDEBAR_DEFAULT }),

      setBottomPanelVisible: (visible) => set({ bottomPanelVisible: visible }),

      toggleBottomPanel: () =>
        set((state) => ({ bottomPanelVisible: !state.bottomPanelVisible })),

      setBottomPanelHeight: (height) => {
        const max = Math.min(BOTTOM_MAX, Math.floor(window.innerHeight * 0.7));
        set({ bottomPanelHeight: clamp(height, BOTTOM_MIN, max) });
      },

      resizeBottomPanelBy: (delta) =>
        set((state) => {
          const max = Math.min(
            BOTTOM_MAX,
            Math.floor(window.innerHeight * 0.7),
          );
          return {
            bottomPanelHeight: clamp(
              state.bottomPanelHeight + delta,
              BOTTOM_MIN,
              max,
            ),
          };
        }),

      resetBottomPanelHeight: () =>
        set({ bottomPanelHeight: BOTTOM_DEFAULT }),

      setBottomPanelTab: (tab) =>
        set({ bottomPanelTab: tab, bottomPanelVisible: true }),
    }),
    {
      name: "aether-layout",
      partialize: (state) => ({
        sidebarWidth: state.sidebarWidth,
        bottomPanelHeight: state.bottomPanelHeight,
        bottomPanelTab: state.bottomPanelTab,
        sidebarVisible: state.sidebarVisible,
        bottomPanelVisible: state.bottomPanelVisible,
        activeActivity: state.activeActivity,
      }),
    },
  ),
);
