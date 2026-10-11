import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Locale } from "@/i18n";

interface SettingsState {
  locale: Locale;
  notice: string | null;
  setLocale: (locale: Locale) => void;
  flashNotice: (message: string, ms?: number) => void;
}

let noticeTimer: number | null = null;

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      locale: "ru",
      notice: null,
      setLocale: (locale) => set({ locale }),
      flashNotice: (message, ms = 4000) => {
        set({ notice: message });
        if (noticeTimer != null) window.clearTimeout(noticeTimer);
        noticeTimer = window.setTimeout(() => {
          set({ notice: null });
          noticeTimer = null;
        }, ms);
      },
    }),
    {
      name: "bpla-studio-settings",
      partialize: (s) => ({ locale: s.locale }),
    },
  ),
);
