import { useEffect } from "react";
import { useDebugStore } from "@/stores/debugStore";
import { useEditorStore } from "@/stores/editorStore";
import { useLayoutStore } from "@/stores/layoutStore";
import { usePaletteStore } from "@/stores/paletteStore";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useSettingsStore } from "@/stores/settingsStore";

/**
 * Global shortcuts (capture phase where noted).
 * - Ctrl+Shift+P — Command Palette
 * - Ctrl+P — Quick Open
 * - Ctrl+S / Ctrl+Shift+S — save
 * - Ctrl+F — find in file (Monaco)
 * - Ctrl+H — replace in file (Monaco)
 * - Ctrl+, — Settings
 * - Ctrl+Shift+F — workspace Search
 * - Ctrl+Shift+G — Source Control
 * - Ctrl+Shift+B — PlatformIO build
 * - Ctrl+Alt+U — PlatformIO upload
 * - F5 / Shift+F5 / F10 / F11 / Shift+F11 — debug
 */
export function useEditorShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const palette = usePaletteStore.getState();
      if (palette.isOpen) return;

      const dbg = useDebugStore.getState();

      // Debug keys (no Ctrl required)
      if (event.key === "F5") {
        event.preventDefault();
        if (event.shiftKey) {
          void dbg.stop();
        } else if (dbg.sessionActive && dbg.execState === "stopped") {
          void dbg.continueExec();
        } else if (!dbg.sessionActive) {
          void dbg.start();
        }
        return;
      }
      if (event.key === "F10" && dbg.sessionActive) {
        event.preventDefault();
        void dbg.stepOver();
        return;
      }
      if (event.key === "F11") {
        event.preventDefault();
        if (event.shiftKey) void dbg.stepOut();
        else void dbg.stepInto();
        return;
      }

      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;

      const key = event.key.toLowerCase();

      // Ctrl+Shift+P → Command Palette; Ctrl+P → Quick Open
      if (key === "p") {
        event.preventDefault();
        if (event.shiftKey) {
          usePaletteStore.getState().open("commands");
        } else {
          usePaletteStore.getState().open("files");
        }
        return;
      }

      // Settings: Ctrl+,
      if (key === ",") {
        event.preventDefault();
        useSettingsStore.getState().openSettings();
        return;
      }

      if (key === "s") {
        event.preventDefault();
        if (event.shiftKey) {
          void useEditorStore.getState().saveAllTabs();
        } else {
          void useEditorStore.getState().saveTab();
        }
        return;
      }

      // Ctrl+Shift+F → workspace search; Ctrl+F → in-editor find
      if (key === "f") {
        if (event.shiftKey) {
          event.preventDefault();
          useLayoutStore.getState().setActiveActivity("search");
          return;
        }
        event.preventDefault();
        useEditorStore.getState().requestFind("find");
        return;
      }

      if (key === "h" && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        useEditorStore.getState().requestFind("replace");
        return;
      }

      if (key === "g" && event.shiftKey) {
        event.preventDefault();
        useLayoutStore.getState().setActiveActivity("source-control");
        return;
      }

      if (key === "b" && event.shiftKey) {
        event.preventDefault();
        void usePlatformIoStore.getState().runTask("build");
        return;
      }

      if (key === "u" && event.altKey) {
        event.preventDefault();
        void usePlatformIoStore.getState().runTask("upload");
        return;
      }

      if (key === "d" && event.shiftKey) {
        event.preventDefault();
        useLayoutStore.getState().setActiveActivity("debug");
        return;
      }

      if (key === "x" && event.shiftKey) {
        event.preventDefault();
        useLayoutStore.getState().setActiveActivity("extensions");
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);
}
