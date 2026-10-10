import { create } from "zustand";
import {
  gitBranches,
  gitCheckout,
  gitCommit,
  gitCreateBranch,
  gitDetect,
  gitDiff,
  gitDiscard,
  gitFetch,
  gitPull,
  gitPush,
  gitStage,
  gitStatus,
  gitUnstage,
  type GitBranch,
  type GitFileEntry,
  type GitInfo,
  type GitStatus,
} from "@/lib/git";
import { joinPath } from "@/lib/paths";
import { isTauriRuntime } from "@/lib/tauri";
import { useWorkspaceStore } from "@/stores/workspaceStore";

function scmCwd(): string | null {
  const { kind, rootPath, folders } = useWorkspaceStore.getState();
  if (kind !== "folder") return null;
  return rootPath ?? folders[0]?.path ?? null;
}

interface ScmState {
  info: GitInfo | null;
  status: GitStatus | null;
  branches: GitBranch[];
  showBranches: boolean;
  message: string;
  busy: boolean;
  error: string | null;
  infoMessage: string | null;
  diffText: string | null;
  diffPath: string | null;
  refresh: () => Promise<void>;
  setMessage: (m: string) => void;
  setShowBranches: (v: boolean) => void;
  stage: (paths: string[]) => Promise<void>;
  unstage: (paths: string[]) => Promise<void>;
  discard: (paths: string[]) => Promise<void>;
  stageAll: () => Promise<void>;
  unstageAll: () => Promise<void>;
  commit: () => Promise<void>;
  checkout: (branch: string) => Promise<void>;
  createBranch: (name: string) => Promise<void>;
  fetch: () => Promise<void>;
  pull: () => Promise<void>;
  push: () => Promise<void>;
  showDiff: (entry: GitFileEntry, staged: boolean) => Promise<void>;
  clearDiff: () => void;
  openFile: (relativePath: string) => Promise<void>;
  changeCount: () => number;
}

export const useScmStore = create<ScmState>((set, get) => ({
  info: null,
  status: null,
  branches: [],
  showBranches: false,
  message: "",
  busy: false,
  error: null,
  infoMessage: null,
  diffText: null,
  diffPath: null,

  setMessage: (m) => set({ message: m }),
  setShowBranches: (v) => set({ showBranches: v }),
  clearDiff: () => set({ diffText: null, diffPath: null }),

  changeCount: () => {
    const s = get().status;
    if (!s) return 0;
    return (
      s.staged.length +
      s.unstaged.length +
      s.untracked.length +
      (s.unmerged?.length ?? 0)
    );
  },

  refresh: async () => {
    if (!isTauriRuntime()) {
      set({
        info: { installed: false, version: null },
        status: null,
        branches: [],
        error: null,
      });
      return;
    }

    const cwd = scmCwd();
    set({ busy: true, error: null });
    try {
      const info = await gitDetect();
      if (!info.installed) {
        set({
          info,
          status: null,
          branches: [],
          busy: false,
          error: "Git not found on PATH.",
        });
        return;
      }
      if (!cwd) {
        set({ info, status: null, branches: [], busy: false, error: null });
        return;
      }
      const status = await gitStatus(cwd);
      let branches: GitBranch[] = [];
      if (status.isRepo) {
        try {
          branches = await gitBranches(cwd);
        } catch {
          branches = [];
        }
      }
      set({ info, status, branches, busy: false, error: null });
    } catch (error) {
      set({
        busy: false,
        error: error instanceof Error ? error.message : "Failed to refresh Git.",
      });
    }
  },

  stage: async (paths) => {
    const cwd = scmCwd();
    if (!cwd || paths.length === 0) return;
    set({ busy: true, error: null });
    try {
      await gitStage(cwd, paths);
      await get().refresh();
    } catch (error) {
      set({
        busy: false,
        error: error instanceof Error ? error.message : "Stage failed.",
      });
    }
  },

  unstage: async (paths) => {
    const cwd = scmCwd();
    if (!cwd || paths.length === 0) return;
    set({ busy: true, error: null });
    try {
      await gitUnstage(cwd, paths);
      await get().refresh();
    } catch (error) {
      set({
        busy: false,
        error: error instanceof Error ? error.message : "Unstage failed.",
      });
    }
  },

  discard: async (paths) => {
    const cwd = scmCwd();
    if (!cwd || paths.length === 0) return;
    const ok = window.confirm(
      `Discard changes in ${paths.length === 1 ? paths[0] : `${paths.length} files`}?`,
    );
    if (!ok) return;
    set({ busy: true, error: null });
    try {
      await gitDiscard(cwd, paths);
      await get().refresh();
    } catch (error) {
      set({
        busy: false,
        error: error instanceof Error ? error.message : "Discard failed.",
      });
    }
  },

  stageAll: async () => {
    const s = get().status;
    if (!s) return;
    const paths = [
      ...s.unstaged.map((e) => e.path),
      ...s.untracked.map((e) => e.path),
    ];
    await get().stage(paths);
  },

  unstageAll: async () => {
    const s = get().status;
    if (!s) return;
    await get().unstage(s.staged.map((e) => e.path));
  },

  commit: async () => {
    const cwd = scmCwd();
    const message = get().message.trim();
    if (!cwd) return;
    if (!message) {
      set({ error: "Enter a commit message." });
      return;
    }
    const staged = get().status?.staged.length ?? 0;
    if (staged === 0) {
      set({ error: "Nothing staged to commit." });
      return;
    }
    set({ busy: true, error: null });
    try {
      await gitCommit(cwd, message);
      set({ message: "", busy: false });
      await get().refresh();
    } catch (error) {
      set({
        busy: false,
        error: error instanceof Error ? error.message : "Commit failed.",
      });
    }
  },

  checkout: async (branch) => {
    const cwd = scmCwd();
    if (!cwd) return;
    set({ busy: true, error: null, infoMessage: null });
    try {
      await gitCheckout(cwd, branch);
      set({ showBranches: false });
      await get().refresh();
    } catch (error) {
      set({
        busy: false,
        error: error instanceof Error ? error.message : "Checkout failed.",
      });
    }
  },

  createBranch: async (name) => {
    const cwd = scmCwd();
    const trimmed = name.trim();
    if (!cwd || !trimmed) return;
    set({ busy: true, error: null, infoMessage: null });
    try {
      await gitCreateBranch(cwd, trimmed, true);
      set({ showBranches: false });
      await get().refresh();
    } catch (error) {
      set({
        busy: false,
        error:
          error instanceof Error ? error.message : "Create branch failed.",
      });
    }
  },

  fetch: async () => {
    const cwd = scmCwd();
    if (!cwd) return;
    set({ busy: true, error: null, infoMessage: null });
    try {
      const msg = await gitFetch(cwd);
      set({ infoMessage: msg, busy: false });
      await get().refresh();
    } catch (error) {
      set({
        busy: false,
        error: error instanceof Error ? error.message : "Fetch failed.",
      });
    }
  },

  pull: async () => {
    const cwd = scmCwd();
    if (!cwd) return;
    set({ busy: true, error: null, infoMessage: null });
    try {
      const msg = await gitPull(cwd);
      set({ infoMessage: msg, busy: false });
      await get().refresh();
    } catch (error) {
      set({
        busy: false,
        error: error instanceof Error ? error.message : "Pull failed.",
      });
    }
  },

  push: async () => {
    const cwd = scmCwd();
    if (!cwd) return;
    set({ busy: true, error: null, infoMessage: null });
    try {
      const msg = await gitPush(cwd, false);
      set({ infoMessage: msg, busy: false });
      await get().refresh();
    } catch (error) {
      set({
        busy: false,
        error: error instanceof Error ? error.message : "Push failed.",
      });
    }
  },

  showDiff: async (entry, staged) => {
    const cwd = scmCwd();
    if (!cwd) return;
    if (entry.group === "untracked") {
      set({
        diffPath: entry.path,
        diffText: "(untracked file — open in editor to view)",
      });
      return;
    }
    try {
      const text = await gitDiff(cwd, { path: entry.path, staged });
      set({
        diffPath: entry.path,
        diffText: text.trim() ? text : "(no textual diff)",
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Diff failed.",
      });
    }
  },

  openFile: async (relativePath) => {
    const status = get().status;
    const cwd = scmCwd();
    const root = status?.root ?? cwd;
    if (!root) return;
    const abs = joinPath(root, relativePath);
    await useWorkspaceStore.getState().openPathInEditor(abs);
  },
}));
