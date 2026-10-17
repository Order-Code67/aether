import { create } from "zustand";
import { persist } from "zustand/middleware";
import { detectDefaultLocale, type Locale } from "@/i18n";
import type { UpdateChannel } from "@/lib/updater";
import { applyTheme, type ThemeId } from "@/lib/theme";

export type WordWrapSetting = "on" | "off" | "wordWrapColumn";
export type { ThemeId };
export type { UpdateChannel };

/** Firmware build/upload backend for .ino / Arduino-style projects. */
export type FirmwareTool = "platformio" | "arduino-cli";

export type SettingsTabId =
  | "general"
  | "editor"
  | "agent"
  | "tools"
  | "about";

interface SettingsState {
  settingsOpen: boolean;
  initialTab: SettingsTabId | null;
  locale: Locale;
  /** UI theme. Default dark for existing users. */
  theme: ThemeId;
  /**
   * Simplified Arduino-oriented density: hide advanced activity items,
   * prefer Sketch mode, emphasize Serial + Output.
   */
  arduinoMode: boolean;
  /**
   * Build/Upload backend: PlatformIO (default) or Arduino CLI for .ino sketches.
   */
  firmwareTool: FirmwareTool;
  /** Arduino-like Explorer: emphasize main sketch, hide .pio clutter. Default ON. */
  sketchMode: boolean;
  /** When Sketch mode is on, still show the full file tree. */
  showAllFiles: boolean;
  /** True after Quick Start finished or user dismissed it. */
  onboardingDone: boolean;
  /**
   * Visible instructional hints in panels + fast chrome tooltips.
   * Default ON for new users (missing key on rehydrate keeps initial true).
   */
  hintsEnabled: boolean;
  /** True after user dismisses the first-open coach (Blink → LoRa → Configurator). */
  hintsCoachDismissed: boolean;
  /** Checked steps for scenario checklists (`scenarioId:messageKey` → true). */
  hintsChecklistChecked: Record<string, boolean>;
  /**
   * Opt-in local diagnostics (build/upload fail). Default OFF — no remote
   * telemetry; see docs/TELEMETRY.md and src/lib/telemetry.ts.
   */
  telemetryOptIn: boolean;
  /**
   * Show the optional «Open external iNav Configurator» control in the FC
   * workspace / checklist / command palette. Off by default — prefer in-app config.
   */
  showExternalInavConfigurator: boolean;
  /** Stable = latest.json; Beta = latest-beta.json. */
  updateChannel: UpdateChannel;
  fontSize: number;
  tabSize: number;
  minimap: boolean;
  wordWrap: WordWrapSetting;
  fontLigatures: boolean;
  lineNumbers: boolean;
  renderWhitespace: "none" | "selection" | "all";
  /** Ephemeral status-bar notice (not persisted). */
  notice: string | null;
  openSettings: (tab?: SettingsTabId) => void;
  closeSettings: () => void;
  toggleSettings: () => void;
  consumeInitialTab: () => SettingsTabId | null;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: ThemeId) => void;
  setArduinoMode: (v: boolean) => void;
  setFirmwareTool: (v: FirmwareTool) => void;
  setSketchMode: (v: boolean) => void;
  setShowAllFiles: (v: boolean) => void;
  setOnboardingDone: (v: boolean) => void;
  setHintsEnabled: (v: boolean) => void;
  setHintsCoachDismissed: (v: boolean) => void;
  toggleHintsChecklistStep: (stepId: string) => void;
  setTelemetryOptIn: (v: boolean) => void;
  setShowExternalInavConfigurator: (v: boolean) => void;
  setUpdateChannel: (channel: UpdateChannel) => void;
  setFontSize: (n: number) => void;
  setTabSize: (n: number) => void;
  setMinimap: (v: boolean) => void;
  setWordWrap: (v: WordWrapSetting) => void;
  setFontLigatures: (v: boolean) => void;
  setLineNumbers: (v: boolean) => void;
  setRenderWhitespace: (v: "none" | "selection" | "all") => void;
  resetEditorDefaults: () => void;
  flashNotice: (message: string, ms?: number) => void;
  clearNotice: () => void;
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

let noticeTimer: ReturnType<typeof setTimeout> | null = null;

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settingsOpen: false,
      initialTab: null,
      locale: detectDefaultLocale(),
      theme: "dark",
      arduinoMode: false,
      firmwareTool: "platformio",
      sketchMode: true,
      showAllFiles: false,
      onboardingDone: false,
      hintsEnabled: true,
      hintsCoachDismissed: false,
      hintsChecklistChecked: {},
      telemetryOptIn: false,
      showExternalInavConfigurator: false,
      updateChannel: "stable",
      ...EDITOR_DEFAULTS,
      notice: null,

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
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      setArduinoMode: (v) =>
        set((s) => ({
          arduinoMode: v,
          // Prefer Sketch mode when entering Arduino simplified UI.
          sketchMode: v ? true : s.sketchMode,
        })),
      setFirmwareTool: (v) =>
        set({
          firmwareTool: v === "arduino-cli" ? "arduino-cli" : "platformio",
        }),
      setSketchMode: (v) => set({ sketchMode: v }),
      setShowAllFiles: (v) => set({ showAllFiles: v }),
      setOnboardingDone: (v) => set({ onboardingDone: v }),
      setHintsEnabled: (v) => set({ hintsEnabled: v }),
      setHintsCoachDismissed: (v) => set({ hintsCoachDismissed: v }),
      toggleHintsChecklistStep: (stepId) =>
        set((s) => {
          const next = { ...s.hintsChecklistChecked };
          if (next[stepId]) delete next[stepId];
          else next[stepId] = true;
          return { hintsChecklistChecked: next };
        }),
      setTelemetryOptIn: (v) => set({ telemetryOptIn: Boolean(v) }),
      setShowExternalInavConfigurator: (v) =>
        set({ showExternalInavConfigurator: v }),
      setUpdateChannel: (channel) =>
        set({ updateChannel: channel === "beta" ? "beta" : "stable" }),

      clearNotice: () => set({ notice: null }),
      flashNotice: (message, ms = 2800) => {
        if (noticeTimer) clearTimeout(noticeTimer);
        set({ notice: message });
        noticeTimer = setTimeout(() => {
          set({ notice: null });
          noticeTimer = null;
        }, ms);
      },

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
        theme: state.theme,
        arduinoMode: state.arduinoMode,
        firmwareTool: state.firmwareTool,
        sketchMode: state.sketchMode,
        showAllFiles: state.showAllFiles,
        onboardingDone: state.onboardingDone,
        hintsEnabled: state.hintsEnabled,
        hintsCoachDismissed: state.hintsCoachDismissed,
        hintsChecklistChecked: state.hintsChecklistChecked,
        telemetryOptIn: state.telemetryOptIn,
        showExternalInavConfigurator: state.showExternalInavConfigurator,
        updateChannel: state.updateChannel,
        fontSize: state.fontSize,
        tabSize: state.tabSize,
        minimap: state.minimap,
        wordWrap: state.wordWrap,
        fontLigatures: state.fontLigatures,
        lineNumbers: state.lineNumbers,
        renderWhitespace: state.renderWhitespace,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.theme) applyTheme(state.theme);
      },
    },
  ),
);

