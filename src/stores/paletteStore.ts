import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PaletteMode = "commands" | "files";

interface PaletteState {
  isOpen: boolean;
  mode: PaletteMode;
  query: string;
  recentCommandIds: string[];
  /** One-shot flag consumed by IdeLayout for New Project dialog */
  newProjectSignal: number;
  open: (mode?: PaletteMode) => void;
  close: () => void;
  setQuery: (query: string) => void;
  rememberCommand: (id: string) => void;
  requestNewProject: () => void;
}

export const usePaletteStore = create<PaletteState>()(
  persist(
    (set) => ({
      isOpen: false,
      mode: "commands",
      query: "",
      recentCommandIds: [],
      newProjectSignal: 0,

      open: (mode = "commands") => set({ isOpen: true, mode, query: "" }),

      close: () => set({ isOpen: false, query: "" }),

      setQuery: (query) => set({ query }),

      rememberCommand: (id) =>
        set((state) => ({
          recentCommandIds: [
            id,
            ...state.recentCommandIds.filter((x) => x !== id),
          ].slice(0, 12),
        })),

      requestNewProject: () =>
        set((s) => ({ newProjectSignal: s.newProjectSignal + 1 })),
    }),
    {
      name: "aether-palette",
      partialize: (state) => ({
        recentCommandIds: state.recentCommandIds,
      }),
    },
  ),
);
