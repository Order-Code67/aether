import { create } from "zustand";
import {
  probeOnline,
  readNavigatorOnline,
} from "@/lib/offline";

interface OfflineState {
  /** True when the app should suppress auto network features. */
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

/** Sync read for non-React call sites. */
export function isAppOffline(): boolean {
  return useOfflineStore.getState().offline;
}
