import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEditorStore } from "@/stores/editorStore";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useSerialStore } from "@/stores/serialStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export interface FirmwareProfile {
  id: string;
  name: string;
  /** PlatformIO env name (e.g. esp32cam). */
  env: string;
  uploadPort: string;
  /** Optional absolute project root to reopen. */
  projectRootHint?: string;
  /** Optional sketch / main path relative or absolute. */
  sketchPath?: string;
  monitorBaud?: number;
  updatedAt: number;
}

interface FirmwareProfileState {
  profiles: FirmwareProfile[];
  saveProfile: (profile: Omit<FirmwareProfile, "id" | "updatedAt"> & { id?: string }) => string;
  deleteProfile: (id: string) => void;
  renameProfile: (id: string, name: string) => void;
  /** Snapshot current PIO/serial/workspace into a named profile. */
  saveCurrentAs: (name: string) => string | null;
  applyProfile: (id: string) => Promise<boolean>;
}

function newId(): string {
  return `fp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useFirmwareProfileStore = create<FirmwareProfileState>()(
  persist(
    (set, get) => ({
      profiles: [],

      saveProfile: (input) => {
        const id = input.id ?? newId();
        const next: FirmwareProfile = {
          id,
          name: input.name.trim() || "Profile",
          env: input.env,
          uploadPort: input.uploadPort,
          projectRootHint: input.projectRootHint,
          sketchPath: input.sketchPath,
          monitorBaud: input.monitorBaud,
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

      renameProfile: (id, name) =>
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === id
              ? { ...p, name: name.trim() || p.name, updatedAt: Date.now() }
              : p,
          ),
        })),

      saveCurrentAs: (name) => {
        const ws = useWorkspaceStore.getState();
        const pio = usePlatformIoStore.getState();
        const serial = useSerialStore.getState();
        if (ws.kind !== "folder" || !ws.rootPath || !pio.isProject) {
          return null;
        }
        const uploadPort =
          pio.uploadPortByRoot[ws.rootPath] || serial.selectedPath || "";
        const activePath = useEditorStore.getState().activeTabId
          ? useEditorStore
              .getState()
              .tabs.find((t) => t.id === useEditorStore.getState().activeTabId)
              ?.path
          : undefined;
        return get().saveProfile({
          name,
          env: pio.selectedEnv,
          uploadPort,
          projectRootHint: ws.rootPath,
          sketchPath: activePath,
          monitorBaud: serial.baudRate,
        });
      },

      applyProfile: async (id) => {
        const profile = get().profiles.find((p) => p.id === id);
        if (!profile) return false;

        const ws = useWorkspaceStore.getState();
        const root = profile.projectRootHint;

        if (root && (ws.rootPath !== root || ws.kind !== "folder")) {
          try {
            await ws.openFolderAt(root);
          } catch {
            // fall through — still apply env/port for current project
          }
        }

        const pio = usePlatformIoStore.getState();
        if (profile.env) {
          pio.setSelectedEnv(profile.env);
        }
        if (profile.uploadPort) {
          pio.setUploadPort(profile.uploadPort);
          useSerialStore.getState().setSelectedPath(profile.uploadPort);
        }
        if (profile.monitorBaud) {
          useSerialStore.getState().setBaudRate(profile.monitorBaud);
        }

        const sketch = profile.sketchPath;
        if (sketch) {
          try {
            const exists = await import("@tauri-apps/plugin-fs").then(
              ({ exists }) => exists(sketch),
            );
            if (exists) {
              await useWorkspaceStore.getState().openPathInEditor(sketch);
            }
          } catch {
            try {
              await useWorkspaceStore.getState().openPathInEditor(sketch);
            } catch {
              // sketch may be missing
            }
          }
        }

        const { t } = await import("@/hooks/useI18n");
        useSettingsStore
          .getState()
          .flashNotice(t("profiles.applied", { name: profile.name }), 3000);
        return true;
      },
    }),
    {
      name: "aether-firmware-profiles",
      partialize: (state) => ({ profiles: state.profiles }),
    },
  ),
);
