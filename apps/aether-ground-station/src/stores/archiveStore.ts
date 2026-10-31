import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ArchiveClip {
  id: string;
  title: string;
  startedAt: string;
  endedAt?: string;
  source: string;
  sizeBytes: number;
  /** Object URL for in-session playback; may be lost after restart */
  objectUrl?: string;
  mimeType?: string;
  filePath?: string;
}

interface ArchiveState {
  clips: ArchiveClip[];
  storageFolder: string;
  addClip: (clip: ArchiveClip) => void;
  removeClip: (id: string) => void;
  setStorageFolder: (folder: string) => void;
}

export const useArchiveStore = create<ArchiveState>()(
  persist(
    (set) => ({
      clips: [],
      storageFolder: "",
      addClip: (clip) => set((s) => ({ clips: [clip, ...s.clips] })),
      removeClip: (id) =>
        set((s) => {
          const clip = s.clips.find((c) => c.id === id);
          if (clip?.objectUrl) URL.revokeObjectURL(clip.objectUrl);
          return { clips: s.clips.filter((c) => c.id !== id) };
        }),
      setStorageFolder: (storageFolder) => set({ storageFolder }),
    }),
    {
      name: "ags-archive-v1",
      partialize: (s) => ({
        clips: s.clips.map(({ objectUrl: _o, ...rest }) => rest),
        storageFolder: s.storageFolder,
      }),
    },
  ),
);
