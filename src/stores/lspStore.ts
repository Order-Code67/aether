import { create } from "zustand";
import {
  lspDetect,
  lspStart,
  lspStatus,
  lspStop,
  type LspInfo,
  type LspStatus,
} from "@/lib/lsp";
import { isTauriRuntime } from "@/lib/tauri";
import { useWorkspaceStore } from "@/stores/workspaceStore";

interface LspState {
  info: LspInfo | null;
  status: LspStatus;
  initializing: boolean;
  error: string | null;
  /** Bumped to force the bridge to re-initialize clangd (e.g. after compiledb). */
  restartToken: number;
  refreshDetect: () => Promise<void>;
  applyStatus: (status: LspStatus) => void;
  startForWorkspace: () => Promise<boolean>;
  requestRestart: () => void;
  stop: () => Promise<void>;
}

const idleStatus: LspStatus = {
  running: false,
  root: null,
  compileCommandsDir: null,
  error: null,
};

export const useLspStore = create<LspState>((set, get) => ({
  info: null,
  status: idleStatus,
  initializing: false,
  error: null,
  restartToken: 0,

  refreshDetect: async () => {
    if (!isTauriRuntime()) {
      set({
        info: { installed: false, command: null, version: null },
        error: null,
      });
      return;
    }
    try {
      const info = await lspDetect();
      set({ info, error: null });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to detect clangd.",
      });
    }
  },

  applyStatus: (status) => {
    set({
      status,
      error: status.error,
    });
  },

  startForWorkspace: async () => {
    if (!isTauriRuntime()) return false;
    const { kind, rootPath } = useWorkspaceStore.getState();
    if (kind !== "folder" || !rootPath) {
      await get().stop();
      return false;
    }

    const info = get().info ?? (await lspDetect());
    set({ info });
    if (!info.installed) {
      set({
        status: idleStatus,
        error: "clangd not found. Install LLVM/clangd and add it to PATH.",
      });
      return false;
    }

    set({ initializing: true, error: null });
    try {
      const status = await lspStart(rootPath);
      set({ status, initializing: false, error: status.error });
      return status.running;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start clangd.";
      set({
        initializing: false,
        status: idleStatus,
        error: message,
      });
      return false;
    }
  },

  requestRestart: () => {
    set((state) => ({ restartToken: state.restartToken + 1 }));
  },

  stop: async () => {
    if (!isTauriRuntime()) {
      set({ status: idleStatus, initializing: false });
      return;
    }
    try {
      await lspStop();
    } catch {
      /* ignore */
    }
    try {
      const status = await lspStatus();
      set({ status, initializing: false, error: status.error });
    } catch {
      set({ status: idleStatus, initializing: false });
    }
  },
}));
