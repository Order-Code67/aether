import { create } from "zustand";

interface UnlockState {
  path: string | null;
  payload: string | null;
  requestUnlock: (path: string, payload: string) => void;
  clear: () => void;
}

export const useUnlockStore = create<UnlockState>((set) => ({
  path: null,
  payload: null,
  requestUnlock: (path, payload) => set({ path, payload }),
  clear: () => set({ path: null, payload: null }),
}));
