import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TabId } from "@/core/plugins/types";

export type Locale = "en" | "ru";
export type ThemeMode = "dark" | "light" | "system";

interface UiState {
  activeTab: TabId;
  locale: Locale;
  theme: ThemeMode;
  sidebarCollapsed: boolean;
  setActiveTab: (tab: TabId) => void;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleSidebar: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      activeTab: "dashboard",
      locale: "ru",
      theme: "dark",
      sidebarCollapsed: false,
      setActiveTab: (activeTab) => set({ activeTab }),
      setLocale: (locale) => set({ locale }),
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: "aether-configurator-ui" },
  ),
);
