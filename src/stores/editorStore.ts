import { create } from "zustand";
import { writeWorkspaceTextFile } from "@/lib/fsWorkspace";
import { isTauriRuntime } from "@/lib/tauri";
import type { CursorPosition, EditorLanguage, EditorTab } from "@/types/editor";
import { languageFromPath, tabNameFromPath } from "@/types/editor";
import type { OpenFileInput } from "@/types/workspace";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; path: string; at: number }
  | { kind: "error"; message: string };

export interface RevealRequest {
  path: string;
  lineNumber: number;
  column: number;
  token: number;
}

export type FindAction = "find" | "replace";

export interface FindRequest {
  action: FindAction;
  token: number;
}

interface EditorState {
  tabs: EditorTab[];
  activeTabId: string | null;
  cursor: CursorPosition;
  saveStatus: SaveStatus;
  revealRequest: RevealRequest | null;
  findRequest: FindRequest | null;
  openFile: (file: OpenFileInput) => void;
  setActiveTab: (id: string) => void;
  closeTab: (id: string) => void;
  closeAllTabs: () => void;
  closeTabsUnder: (path: string) => void;
  renameTabPath: (oldPath: string, newPath: string) => void;
  updateContent: (id: string, content: string) => void;
  replaceContentFromDisk: (path: string, content: string) => void;
  markClean: (id: string) => void;
  setCursor: (cursor: CursorPosition) => void;
  requestReveal: (pos: Omit<RevealRequest, "token">) => void;
  requestFind: (action?: FindAction) => void;
  clearSaveStatus: () => void;
  saveTab: (id?: string) => Promise<boolean>;
  saveAllTabs: () => Promise<boolean>;
}

function createTab(file: OpenFileInput): EditorTab {
  const language: EditorLanguage =
    file.language ?? languageFromPath(file.path);

  return {
    id: file.path,
    path: file.path,
    name: tabNameFromPath(file.path),
    language,
    content: file.content,
    dirty: false,
  };
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  cursor: { lineNumber: 1, column: 1 },
  saveStatus: { kind: "idle" },
  revealRequest: null,
  findRequest: null,

  openFile: (file) => {
    const existing = get().tabs.find((tab) => tab.path === file.path);
    if (existing) {
      set({ activeTabId: existing.id });
      return;
    }

    const tab = createTab(file);
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
    }));
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  requestReveal: (pos) =>
    set((state) => ({
      cursor: { lineNumber: pos.lineNumber, column: pos.column },
      revealRequest: {
        ...pos,
        token: (state.revealRequest?.token ?? 0) + 1,
      },
    })),

  requestFind: (action = "find") =>
    set((state) => ({
      findRequest: {
        action,
        token: (state.findRequest?.token ?? 0) + 1,
      },
    })),

  closeTab: (id) => {
    const { tabs, activeTabId } = get();
    const index = tabs.findIndex((tab) => tab.id === id);
    if (index === -1) return;

    const tab = tabs[index];
    if (tab?.dirty) {
      const discard = window.confirm(
        `"${tab.name}" has unsaved changes. Close anyway?`,
      );
      if (!discard) return;
    }

    const nextTabs = tabs.filter((t) => t.id !== id);
    let nextActive = activeTabId;

    if (activeTabId === id) {
      const neighbor = nextTabs[index] ?? nextTabs[index - 1] ?? null;
      nextActive = neighbor?.id ?? null;
    }

    set({
      tabs: nextTabs,
      activeTabId: nextActive,
      cursor: nextActive ? get().cursor : { lineNumber: 1, column: 1 },
    });
  },

  closeAllTabs: () =>
    set({
      tabs: [],
      activeTabId: null,
      cursor: { lineNumber: 1, column: 1 },
      saveStatus: { kind: "idle" },
    }),

  closeTabsUnder: (path) => {
    const root = path.replace(/\//g, "\\").toLowerCase();
    const { tabs, activeTabId } = get();
    const nextTabs = tabs.filter((tab) => {
      const p = tab.path.replace(/\//g, "\\").toLowerCase();
      return p !== root && !p.startsWith(`${root}\\`);
    });
    if (nextTabs.length === tabs.length) return;
    const stillActive =
      activeTabId && nextTabs.some((t) => t.id === activeTabId)
        ? activeTabId
        : (nextTabs[nextTabs.length - 1]?.id ?? null);
    set({
      tabs: nextTabs,
      activeTabId: stillActive,
      cursor: stillActive ? get().cursor : { lineNumber: 1, column: 1 },
    });
  },

  renameTabPath: (oldPath, newPath) => {
    const oldNorm = oldPath.replace(/\//g, "\\").toLowerCase();
    const remap = (path: string): string => {
      const p = path.replace(/\//g, "\\").toLowerCase();
      if (p === oldNorm) return newPath;
      if (p.startsWith(`${oldNorm}\\`)) {
        return `${newPath}${path.slice(oldPath.length)}`;
      }
      return path;
    };
    set((state) => ({
      tabs: state.tabs.map((tab) => {
        const next = remap(tab.path);
        if (next === tab.path) return tab;
        return {
          ...tab,
          id: next,
          path: next,
          name: tabNameFromPath(next),
          language: languageFromPath(next),
        };
      }),
      activeTabId: state.activeTabId
        ? remap(state.activeTabId)
        : state.activeTabId,
    }));
  },

  updateContent: (id, content) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id ? { ...tab, content, dirty: true } : tab,
      ),
    })),

  replaceContentFromDisk: (path, content) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.path === path && !tab.dirty
          ? { ...tab, content, dirty: false }
          : tab,
      ),
    })),

  markClean: (id) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id ? { ...tab, dirty: false } : tab,
      ),
    })),

  setCursor: (cursor) => set({ cursor }),

  clearSaveStatus: () => set({ saveStatus: { kind: "idle" } }),

  saveTab: async (id) => {
    const state = get();
    const tabId = id ?? state.activeTabId;
    if (!tabId) return false;

    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return false;
    if (!tab.dirty) return true;

    const workspaceKind = useWorkspaceStore.getState().kind;

    if (workspaceKind === "demo") {
      set({
        saveStatus: {
          kind: "error",
          message: "Demo workspace is in-memory only. Open a folder to save.",
        },
      });
      return false;
    }

    if (workspaceKind !== "folder") {
      set({
        saveStatus: {
          kind: "error",
          message: "Open a folder before saving files.",
        },
      });
      return false;
    }

    if (!isTauriRuntime()) {
      set({
        saveStatus: {
          kind: "error",
          message: "Saving requires the desktop app (npm run tauri:dev).",
        },
      });
      return false;
    }

    set({ saveStatus: { kind: "saving" } });

    try {
      await writeWorkspaceTextFile(tab.path, tab.content);
      get().markClean(tab.id);
      set({
        saveStatus: {
          kind: "saved",
          path: tab.path,
          at: Date.now(),
        },
      });
      return true;
    } catch (error) {
      set({
        saveStatus: {
          kind: "error",
          message:
            error instanceof Error ? error.message : "Failed to save file.",
        },
      });
      return false;
    }
  },

  saveAllTabs: async () => {
    const dirtyTabs = get().tabs.filter((tab) => tab.dirty);
    if (dirtyTabs.length === 0) return true;

    let allOk = true;
    for (const tab of dirtyTabs) {
      const ok = await get().saveTab(tab.id);
      if (!ok) allOk = false;
    }
    return allOk;
  },
}));
