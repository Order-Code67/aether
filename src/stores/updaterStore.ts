import { create } from "zustand";
import {
  checkForAppUpdate,
  downloadAndInstallPendingUpdate,
  relaunchApp,
  type ChannelUpdateInfo,
  type UpdateProgress,
} from "@/lib/updater";
import { isTauriRuntime } from "@/lib/tauri";
import { isAppOffline } from "@/stores/offlineStore";
import { useSettingsStore } from "@/stores/settingsStore";

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
  pending: ChannelUpdateInfo | null;
  /** When true, show UpdateDialog (available / downloading / error after user action). */
  dialogOpen: boolean;
  lastCheckedAt: number | null;
  /** Quiet startup check already ran this session. */
  quietChecked: boolean;
  check: (opts?: { quiet?: boolean; openDialog?: boolean }) => Promise<void>;
  quietCheckOnStartup: () => Promise<void>;
  installAndRelaunch: () => Promise<void>;
  closeDialog: () => void;
  openDialog: () => void;
  reset: () => void;
}

export const useUpdaterStore = create<UpdaterState>((set, get) => ({
  phase: "idle",
  availableVersion: null,
  notes: null,
  error: null,
  progress: null,
  pending: null,
  dialogOpen: false,
  lastCheckedAt: null,
  quietChecked: false,

  reset: () =>
    set({
      phase: "idle",
      availableVersion: null,
      notes: null,
      error: null,
      progress: null,
      pending: null,
      dialogOpen: false,
    }),

  closeDialog: () => set({ dialogOpen: false }),

  openDialog: () => set({ dialogOpen: true }),

  quietCheckOnStartup: async () => {
    if (!isTauriRuntime() || get().quietChecked) return;
    set({ quietChecked: true });
    // Never block startup offline — skip silently.
    if (isAppOffline()) {
      set({
        phase: "unavailable",
        error: null,
        lastCheckedAt: Date.now(),
        dialogOpen: false,
      });
      return;
    }
    // Fire-and-forget: do not await on the UI path beyond this store call.
    void get().check({ quiet: true, openDialog: true });
  },

  check: async (opts) => {
    const quiet = opts?.quiet === true;
    const openDialog = opts?.openDialog === true;
    if (isAppOffline()) {
      set({
        phase: "unavailable",
        // Quiet startup: silent. Manual check: one-line notice via Settings.
        error: quiet ? null : "offline",
        lastCheckedAt: Date.now(),
        dialogOpen: false,
        progress: null,
        availableVersion: null,
        notes: null,
        pending: null,
      });
      return;
    }
    const channel = useSettingsStore.getState().updateChannel;
    set({
      phase: "checking",
      error: null,
      progress: null,
      availableVersion: null,
      notes: null,
      pending: null,
      // Quiet up-to-date must not flash a modal.
      dialogOpen: quiet ? false : get().dialogOpen,
    });
    const result = await checkForAppUpdate(channel);
    const checkedAt = Date.now();

    if (result.kind === "uptodate") {
      set({
        phase: "uptodate",
        lastCheckedAt: checkedAt,
        dialogOpen: false,
      });
      return;
    }
    if (result.kind === "unavailable") {
      set({
        phase: "unavailable",
        lastCheckedAt: checkedAt,
        dialogOpen: false,
        error: quiet
          ? null
          : "Update server not reachable yet (no release feed). Publish latest.json to enable updates.",
      });
      return;
    }
    if (result.kind === "error") {
      set({
        phase: "error",
        lastCheckedAt: checkedAt,
        error: result.message,
        // Manual check: surface error in Settings; quiet startup stays silent.
        dialogOpen: quiet ? false : openDialog,
      });
      return;
    }
    set({
      phase: "available",
      pending: result.info,
      availableVersion: result.info.version,
      notes: result.info.body ?? null,
      lastCheckedAt: checkedAt,
      dialogOpen: openDialog || !quiet,
    });
  },

  installAndRelaunch: async () => {
    if (!get().pending) {
      set({ phase: "error", error: "No update queued. Check for updates first." });
      return;
    }
    set({
      phase: "downloading",
      error: null,
      progress: { downloaded: 0, contentLength: null },
      dialogOpen: true,
    });
    try {
      await downloadAndInstallPendingUpdate((progress) => {
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
        dialogOpen: true,
      });
    }
  },
}));
