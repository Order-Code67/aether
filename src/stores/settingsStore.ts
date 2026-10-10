import { create } from "zustand";
import { persist } from "zustand/middleware";
import { detectDefaultLocale, type Locale } from "@/i18n";

export type WordWrapSetting = "on" | "off" | "wordWrapColumn";

export type SettingsTabId = "general" | "editor" | "agent" | "tools" | "about";

interface SettingsState {
  settingsOpen: boolean;
  initialTab: SettingsTabId | null;
  locale: Locale;
  /** Arduino-like Explorer: emphasize main sketch, hide .pio clutter. Default ON. */
  sketchMode: boolean;
  /** When Sketch mode is on, still show the full file tree. */
  showAllFiles: boolean;
  fontSize: number;
  tabSize: number;
  minimap: boolean;
  wordWrap: WordWrapSetting;
  fontLigatures: boolean;
  lineNumbers: boolean;
  renderWhitespace: "none" | "selection" | "all";
  openSettings: (tab?: SettingsTabId) => void;
  closeSettings: () => void;
  toggleSettings: () => void;
  consumeInitialTab: () => SettingsTabId | null;
  setLocale: (locale: Locale) => void;
  setSketchMode: (v: boolean) => void;
  setShowAllFiles: (v: boolean) => void;
  setFontSize: (n: number) => void;
  setTabSize: (n: number) => void;
  setMinimap: (v: boolean) => void;
  setWordWrap: (v: WordWrapSetting) => void;
  setFontLigatures: (v: boolean) => void;
  setLineNumbers: (v: boolean) => void;
  setRenderWhitespace: (v: "none" | "selection" | "all") => void;
  resetEditorDefaults: () => void;
}

const EDITOR_DEFAULTS = {
  fontSize: 13,
  tabSize: 2,
  minimap: true,
  wordWrap: "off" as WordWrapSetting,
  fontLigatures: true,
  lineNumbers: true,
  renderWhitespace: "selection" as const,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settingsOpen: false,
      initialTab: null,
      locale: detectDefaultLocale(),
      sketchMode: true,
      showAllFiles: false,
      ...EDITOR_DEFAULTS,

      openSettings: (tab) =>
        set({ settingsOpen: true, initialTab: tab ?? null }),
      closeSettings: () => set({ settingsOpen: false, initialTab: null }),
      toggleSettings: () =>
        set((s) => ({
          settingsOpen: !s.settingsOpen,
          initialTab: s.settingsOpen ? null : s.initialTab,
        })),
      consumeInitialTab: () => {
        const tab = get().initialTab;
        if (tab) set({ initialTab: null });
        return tab;
      },

      setLocale: (locale) => set({ locale }),
      setSketchMode: (v) => set({ sketchMode: v }),
      setShowAllFiles: (v) => set({ showAllFiles: v }),

      setFontSize: (n) =>
        set({ fontSize: Math.min(28, Math.max(10, Math.round(n))) }),
      setTabSize: (n) =>
        set({ tabSize: Math.min(8, Math.max(1, Math.round(n))) }),
      setMinimap: (v) => set({ minimap: v }),
      setWordWrap: (v) => set({ wordWrap: v }),
      setFontLigatures: (v) => set({ fontLigatures: v }),
      setLineNumbers: (v) => set({ lineNumbers: v }),
      setRenderWhitespace: (v) => set({ renderWhitespace: v }),
      resetEditorDefaults: () => set({ ...EDITOR_DEFAULTS }),
    }),
    {
      name: "aether-settings",
      partialize: (state) => ({
        locale: state.locale,
        sketchMode: state.sketchMode,
        showAllFiles: state.showAllFiles,
        fontSize: state.fontSize,
        tabSize: state.tabSize,
        minimap: state.minimap,
        wordWrap: state.wordWrap,
        fontLigatures: state.fontLigatures,
        lineNumbers: state.lineNumbers,
        renderWhitespace: state.renderWhitespace,
      }),
    },
  ),
);
