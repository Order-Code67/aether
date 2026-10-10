import { create } from "zustand";
import { persist } from "zustand/middleware";
import { cameraReconnectDelayMs } from "@/lib/cameraCapture";
import { normalizeCameraUrl } from "@/lib/cameraIp";

export type CameraStatus =
  | "idle"
  | "loading"
  | "live"
  | "error"
  | "reconnecting";

interface CameraState {
  url: string;
  /** Cache-busted URL currently shown in <img>. */
  displaySrc: string;
  /** Last successfully loaded frame URL (kept on Wi‑Fi drop). */
  lastGoodSrc: string;
  status: CameraStatus;
  error: string | null;
  /** Auto-refresh interval ms; 0 = manual only. */
  refreshMs: number;
  keepLastFrame: boolean;
  reconnectAttempt: number;
  recording: boolean;
  recordProgress: { done: number; total: number } | null;
  setUrl: (url: string) => void;
  applySuggestedUrl: (url: string) => void;
  setRefreshMs: (ms: number) => void;
  setKeepLastFrame: (keep: boolean) => void;
  connect: () => void;
  refresh: () => void;
  setError: (message: string) => void;
  setLive: () => void;
  disconnect: () => void;
  /** Schedule a reconnect after load error (backoff). */
  scheduleReconnect: () => void;
  cancelReconnect: () => void;
  setRecording: (recording: boolean) => void;
  setRecordProgress: (progress: { done: number; total: number } | null) => void;
}

let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function withCacheBust(url: string): string {
  const normalized = normalizeCameraUrl(url);
  if (!normalized) return "";
  const sep = normalized.includes("?") ? "&" : "?";
  return `${normalized}${sep}_t=${Date.now()}`;
}

function clearReconnectTimer() {
  if (reconnectTimer != null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

export const useCameraStore = create<CameraState>()(
  persist(
    (set, get) => ({
      url: "http://192.168.4.1/capture",
      displaySrc: "",
      lastGoodSrc: "",
      status: "idle",
      error: null,
      refreshMs: 0,
      keepLastFrame: true,
      reconnectAttempt: 0,
      recording: false,
      recordProgress: null,

      setUrl: (url) => set({ url }),

      applySuggestedUrl: (url) => {
        const current = get().url.trim();
        if (
          !current ||
          current === "http://192.168.4.1/capture" ||
          current === "http://192.168.4.1/stream"
        ) {
          set({ url });
        }
      },

      setRefreshMs: (ms) => set({ refreshMs: ms }),

      setKeepLastFrame: (keep) => set({ keepLastFrame: keep }),

      connect: () => {
        clearReconnectTimer();
        const url = get().url.trim();
        if (!url) {
          set({ status: "error", error: "empty", displaySrc: "" });
          return;
        }
        set({
          status: "loading",
          error: null,
          reconnectAttempt: 0,
          displaySrc: withCacheBust(url),
        });
      },

      refresh: () => {
        const url = get().url.trim();
        if (!url) return;
        const status = get().status;
        if (status === "idle") {
          set({
            status: "loading",
            error: null,
            displaySrc: withCacheBust(url),
          });
          return;
        }
        // Don't freeze UI: refresh display while keeping last good frame visible
        // until the new one loads (img key changes on displaySrc).
        set({
          error: null,
          displaySrc: withCacheBust(url),
          status:
            status === "error" || status === "reconnecting"
              ? "reconnecting"
              : status === "live"
                ? "live"
                : "loading",
        });
      },

      setError: (message) => {
        set({
          status: "error",
          error: message || "load_failed",
        });
        get().scheduleReconnect();
      },

      setLive: () => {
        clearReconnectTimer();
        const src = get().displaySrc;
        set({
          status: "live",
          error: null,
          reconnectAttempt: 0,
          lastGoodSrc: src || get().lastGoodSrc,
        });
      },

      disconnect: () => {
        clearReconnectTimer();
        set({
          status: "idle",
          displaySrc: "",
          error: null,
          reconnectAttempt: 0,
          recording: false,
          recordProgress: null,
        });
      },

      scheduleReconnect: () => {
        clearReconnectTimer();
        if (get().status === "idle") return;
        const attempt = get().reconnectAttempt;
        const delay = cameraReconnectDelayMs(attempt);
        set({
          status: "reconnecting",
          reconnectAttempt: attempt + 1,
          // Clear probe URL so we don't immediately re-fire onError
          displaySrc: "",
        });
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          if (get().status === "idle") return;
          const url = get().url.trim();
          if (!url) return;
          // New cache-busted URL; UI stays on lastGoodSrc until onLoad
          set({
            displaySrc: withCacheBust(url),
            error: null,
            status: "reconnecting",
          });
        }, delay);
      },

      cancelReconnect: () => {
        clearReconnectTimer();
      },

      setRecording: (recording) => set({ recording }),

      setRecordProgress: (progress) => set({ recordProgress: progress }),
    }),
    {
      name: "aether-camera",
      partialize: (state) => ({
        url: state.url,
        refreshMs: state.refreshMs,
        keepLastFrame: state.keepLastFrame,
      }),
    },
  ),
);
