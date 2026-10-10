import { create } from "zustand";
import type { Update } from "@tauri-apps/plugin-updater";
import {
  checkForAppUpdate,
  downloadAndInstallUpdate,
  relaunchApp,
  type UpdateProgress,
} from "@/lib/updater";

type UpdaterPhase =
  | "idle"
  | "checking"
  | "uptodate"
  | "unavailable"
  | "available"
  | "downloading"
  | "ready"
  | "error";

interface UpdaterState {
  phase: UpdaterPhase;
  availableVersion: string | null;
  notes: string | null;
  error: string | null;
  progress: UpdateProgress | null;
  pending: Update | null;
  check: () => Promise<void>;
  installAndRelaunch: () => Promise<void>;
  reset: () => void;
}

export const useUpdaterStore = create<UpdaterState>((set, get) => ({
  phase: "idle",
  availableVersion: null,
  notes: null,
  error: null,
  progress: null,
  pending: null,

  reset: () =>
    set({
      phase: "idle",
      availableVersion: null,
      notes: null,
      error: null,
      progress: null,
      pending: null,
    }),

  check: async () => {
    set({
      phase: "checking",
      error: null,
      progress: null,
      availableVersion: null,
      notes: null,
      pending: null,
    });
    const result = await checkForAppUpdate();
    if (result.kind === "uptodate") {
      set({ phase: "uptodate" });
      return;
    }
    if (result.kind === "unavailable") {
      set({
        phase: "unavailable",
        error:
          "Update server not reachable yet (no release feed). Publish latest.json to enable updates.",
      });
      return;
    }
    if (result.kind === "error") {
      set({ phase: "error", error: result.message });
      return;
    }
    set({
      phase: "available",
      pending: result.update,
      availableVersion: result.update.version,
      notes: result.update.body ?? null,
    });
  },

  installAndRelaunch: async () => {
    const update = get().pending;
    if (!update) {
      set({ phase: "error", error: "No update queued. Check for updates first." });
      return;
    }
    set({ phase: "downloading", error: null, progress: { downloaded: 0, contentLength: null } });
    try {
      await downloadAndInstallUpdate(update, (progress) => {
        set({ progress });
      });
      set({ phase: "ready" });
      await relaunchApp();
    } catch (error) {
      set({
        phase: "error",
        error:
          error instanceof Error
            ? error.message
            : "Failed to download or install the update.",
      });
    }
  },
}));
