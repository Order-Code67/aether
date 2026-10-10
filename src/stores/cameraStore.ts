import { create } from "zustand";
import { persist } from "zustand/middleware";
import { normalizeCameraUrl } from "@/lib/cameraIp";

export type CameraStatus = "idle" | "loading" | "live" | "error";

interface CameraState {
  url: string;
  /** Cache-busted URL currently shown in <img>. */
  displaySrc: string;
  status: CameraStatus;
  error: string | null;
  /** Auto-refresh interval ms; 0 = manual only. */
  refreshMs: number;
  setUrl: (url: string) => void;
  applySuggestedUrl: (url: string) => void;
  setRefreshMs: (ms: number) => void;
  connect: () => void;
  refresh: () => void;
  setError: (message: string) => void;
  setLive: () => void;
  disconnect: () => void;
}

function withCacheBust(url: string): string {
  const normalized = normalizeCameraUrl(url);
  if (!normalized) return "";
  const sep = normalized.includes("?") ? "&" : "?";
  return `${normalized}${sep}_t=${Date.now()}`;
}

export const useCameraStore = create<CameraState>()(
  persist(
    (set, get) => ({
      url: "http://192.168.4.1/capture",
      displaySrc: "",
      status: "idle",
      error: null,
      refreshMs: 0,

      setUrl: (url) => set({ url }),

      applySuggestedUrl: (url) => {
        const current = get().url.trim();
        // Autofill when empty or still the default AP address
        if (
          !current ||
          current === "http://192.168.4.1/capture" ||
          current === "http://192.168.4.1/stream"
        ) {
          set({ url });
        }
      },

      setRefreshMs: (ms) => set({ refreshMs: ms }),

      connect: () => {
        const url = get().url.trim();
        if (!url) {
          set({ status: "error", error: "empty", displaySrc: "" });
          return;
        }
        set({
          status: "loading",
          error: null,
          displaySrc: withCacheBust(url),
        });
      },

      refresh: () => {
        const url = get().url.trim();
        if (!url) return;
        set({
          status: get().status === "idle" ? "loading" : get().status,
          error: null,
          displaySrc: withCacheBust(url),
        });
      },

      setError: (message) =>
        set({ status: "error", error: message || "load_failed" }),

      setLive: () => set({ status: "live", error: null }),

      disconnect: () =>
        set({ status: "idle", displaySrc: "", error: null }),
    }),
    {
      name: "aether-camera",
      partialize: (state) => ({
        url: state.url,
        refreshMs: state.refreshMs,
      }),
    },
  ),
);
