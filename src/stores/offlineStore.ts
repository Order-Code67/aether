import { create } from "zustand";
import {
  isNavigatorOffline,
  probeOnline,
  readNavigatorOnline,
} from "@/lib/offline";

interface OfflineState {
  /**
   * Soft offline: navigator offline OR connectivity probe failed.
   * Use for suppressing auto network features (updates, registry prefetch).
   * Do NOT hard-block AI solely on this — probe hosts often fail in WebView2.
   */
  offline: boolean;
  /** Last probe timestamp (ms). */
  lastCheckedAt: number | null;
  /** Start browser listeners + initial probe (idempotent). */
  init: () => void;
  /** Re-run connectivity probe (non-blocking for callers). */
  refresh: () => Promise<void>;
  setOffline: (offline: boolean) => void;
}

let initialized = false;
let probeInFlight: Promise<void> | null = null;

export const useOfflineStore = create<OfflineState>((set, get) => ({
  offline: !readNavigatorOnline(),
  lastCheckedAt: null,

  setOffline: (offline) => set({ offline, lastCheckedAt: Date.now() }),

  refresh: async () => {
    if (probeInFlight) return probeInFlight;
    probeInFlight = (async () => {
      if (!readNavigatorOnline()) {
        set({ offline: true, lastCheckedAt: Date.now() });
        return;
      }
      const online = await probeOnline();
      set({ offline: !online, lastCheckedAt: Date.now() });
    })().finally(() => {
      probeInFlight = null;
    });
    return probeInFlight;
  },

  init: () => {
    if (initialized || typeof window === "undefined") return;
    initialized = true;

    const onOffline = () => get().setOffline(true);
    const onOnline = () => {
      // navigator flipped online — confirm with a short probe.
      get().setOffline(false);
      void get().refresh();
    };

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    if (!readNavigatorOnline()) {
      set({ offline: true, lastCheckedAt: Date.now() });
    } else {
      void get().refresh();
    }
  },
}));

/** Soft offline (probe may be wrong). Prefer for auto-features only. */
export function isAppOffline(): boolean {
  return useOfflineStore.getState().offline;
}

/** Hard offline — only `navigator.onLine === false`. Safe to hard-block AI. */
export function isHardOffline(): boolean {
  return isNavigatorOffline();
}
