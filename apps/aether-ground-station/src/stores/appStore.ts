import { create } from "zustand";
import type { AppInfo } from "@/types";

interface AppState {
  appInfo: AppInfo | null;
  ready: boolean;
  setAppInfo: (info: AppInfo | null) => void;
  setReady: (ready: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  appInfo: null,
  ready: false,
  setAppInfo: (appInfo) => set({ appInfo }),
  setReady: (ready) => set({ ready }),
}));
