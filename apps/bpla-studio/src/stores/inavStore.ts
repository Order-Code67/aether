import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { InavConfiguratorTab } from "@/lib/inavTabs";
import type { MspStatusSnapshot } from "@/lib/mspMinimal";
import { pollMspStatus } from "@/lib/mspStatusPoll";
import { releaseSerialBeforeUpload } from "@/lib/uploadGate";
import { useSerialStore } from "@/stores/serialStore";

const MAX_CLI_LINES = 4000;

export interface InavProfile {
  id: string;
  name: string;
  port: string;
  baud: number;
  lastDiffPath?: string;
  notes?: string;
  updatedAt: number;
}

interface InavState {
  profiles: InavProfile[];
  /** Exclusive CLI session owned by the iNav panel. */
  sessionActive: boolean;
  /** Active configurator section (shared by sidebar nav + workspace). */
  activeTab: InavConfiguratorTab;
  /** When true, serial lines are also appended to diffBuffer. */
  capturingDiff: boolean;
  cliLines: string[];
  diffBuffer: string;
  lastDiffPath: string;
  draftName: string;
  draftNotes: string;
  error: string | null;

  /** Last MSP Status snapshot (read-only). */
  mspSnapshot: MspStatusSnapshot | null;
  mspPolling: boolean;
  mspError: string | null;

  setActiveTab: (tab: InavConfiguratorTab) => void;
  appendCliLine: (line: string) => void;
  clearCli: () => void;
  setDiffBuffer: (text: string) => void;
  appendDiffCapture: (chunk: string) => void;
  setCapturingDiff: (value: boolean) => void;
  setLastDiffPath: (path: string) => void;
  setDraftName: (name: string) => void;
  setDraftNotes: (notes: string) => void;
  setSessionActive: (active: boolean) => void;
  setError: (error: string | null) => void;

  /** Disconnect competing serial consumers, then open the selected port. */
  connectSession: () => Promise<void>;
  disconnectSession: () => Promise<void>;
  /** Ensure Aether releases the COM port (e.g. before Configurator). */
  releasePort: () => Promise<void>;

  /** Poll MSP identity / status / analog / GPS (read-only). */
  refreshMspStatus: () => Promise<void>;
  clearMspStatus: () => void;

  saveProfile: (
    input: Omit<InavProfile, "id" | "updatedAt"> & { id?: string },
  ) => string;
  deleteProfile: (id: string) => void;
  applyProfile: (id: string) => void;
  saveCurrentAs: (name: string) => string;
}

function newId(): string {
  return `inav_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useInavStore = create<InavState>()(
  persist(
    (set, get) => ({
      profiles: [],
      sessionActive: false,
      activeTab: "setup",
      capturingDiff: false,
      cliLines: [],
      diffBuffer: "",
      lastDiffPath: "",
      draftName: "",
      draftNotes: "",
      error: null,
      mspSnapshot: null,
      mspPolling: false,
      mspError: null,

      setActiveTab: (tab) => set({ activeTab: tab }),

      appendCliLine: (line) =>
        set((state) => {
          const next = [...state.cliLines, line];
          if (next.length > MAX_CLI_LINES) {
            return { cliLines: next.slice(next.length - MAX_CLI_LINES) };
          }
          return { cliLines: next };
        }),

      clearCli: () => set({ cliLines: [] }),

      setDiffBuffer: (text) => set({ diffBuffer: text }),

      appendDiffCapture: (chunk) =>
        set((state) => ({
          diffBuffer: state.diffBuffer
            ? `${state.diffBuffer}${chunk}`
            : chunk,
        })),

      setCapturingDiff: (value) => set({ capturingDiff: value }),
      setLastDiffPath: (path) => set({ lastDiffPath: path }),
      setDraftName: (name) => set({ draftName: name }),
      setDraftNotes: (notes) => set({ draftNotes: notes }),
      setSessionActive: (active) => set({ sessionActive: active }),
      setError: (error) => set({ error }),

      connectSession: async () => {
        const serial = useSerialStore.getState();
        if (!serial.selectedPath) {
          set({ error: "Select a serial port first." });
          return;
        }
        set({ error: null });
        await releaseSerialBeforeUpload(serial);
        // Brief pause so the OS releases the handle before reopen.
        await new Promise((r) => setTimeout(r, 150));
        await useSerialStore.getState().connect();
        const after = useSerialStore.getState();
        if (after.connected) {
          set({ sessionActive: true, error: null });
          // Auto identity/status poll so the configurator HUD fills in.
          void get().refreshMspStatus();
        } else {
          set({
            sessionActive: false,
            error: after.error ?? "Failed to open serial port.",
          });
        }
      },

      disconnectSession: async () => {
        set({ sessionActive: false, mspPolling: false });
        await useSerialStore.getState().disconnect();
      },

      releasePort: async () => {
        set({ sessionActive: false, mspPolling: false });
        const serial = useSerialStore.getState();
        await releaseSerialBeforeUpload(serial);
      },

      refreshMspStatus: async () => {
        const serial = useSerialStore.getState();
        if (!serial.connected || !get().sessionActive) {
          set({ mspError: "MSP_NEED_CONNECT" });
          return;
        }
        if (get().mspPolling) return;
        set({ mspPolling: true, mspError: null });
        const result = await pollMspStatus();
        if (result.ok) {
          set({
            mspSnapshot: result.snapshot,
            mspPolling: false,
            mspError: null,
          });
        } else {
          set({
            mspSnapshot: result.snapshot,
            mspPolling: false,
            mspError: result.error,
          });
        }
      },

      clearMspStatus: () => set({ mspSnapshot: null, mspError: null }),

      saveProfile: (input) => {
        const id = input.id ?? newId();
        const next: InavProfile = {
          id,
          name: input.name.trim() || "iNav",
          port: input.port,
          baud: input.baud,
          lastDiffPath: input.lastDiffPath,
          notes: input.notes,
          updatedAt: Date.now(),
        };
        set((state) => {
          const rest = state.profiles.filter((p) => p.id !== id);
          return { profiles: [next, ...rest] };
        });
        return id;
      },

      deleteProfile: (id) =>
        set((state) => ({
          profiles: state.profiles.filter((p) => p.id !== id),
        })),

      applyProfile: (id) => {
        const profile = get().profiles.find((p) => p.id === id);
        if (!profile) return;
        const serial = useSerialStore.getState();
        if (profile.port) serial.setSelectedPath(profile.port);
        if (profile.baud) serial.setBaudRate(profile.baud);
        set({
          draftName: profile.name,
          draftNotes: profile.notes ?? "",
          lastDiffPath: profile.lastDiffPath ?? "",
        });
      },

      saveCurrentAs: (name) => {
        const serial = useSerialStore.getState();
        const { lastDiffPath, draftNotes } = get();
        return get().saveProfile({
          name,
          port: serial.selectedPath,
          baud: serial.baudRate,
          lastDiffPath: lastDiffPath || undefined,
          notes: draftNotes || undefined,
        });
      },
    }),
    {
      name: "aether-inav-profiles",
      partialize: (state) => ({
        profiles: state.profiles,
        lastDiffPath: state.lastDiffPath,
        draftName: state.draftName,
        draftNotes: state.draftNotes,
        activeTab: state.activeTab,
      }),
    },
  ),
);
