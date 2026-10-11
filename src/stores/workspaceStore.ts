import { create } from "zustand";
import {
  DEMO_TREE,
  resolveDemoFile,
  type DemoTreeNode,
} from "@/lib/demoWorkspace";
import {
  createWorkspaceFile,
  createWorkspaceFolder,
  deleteWorkspacePath,
  listDirectory,
  pickWorkspaceFolder,
  readWorkspaceTextFile,
  renameWorkspacePath,
} from "@/lib/fsWorkspace";
import { basename, dirname, workspaceLabel } from "@/lib/paths";
import { isTauriRuntime } from "@/lib/tauri";
import { useEditorStore } from "@/stores/editorStore";
import type {
  FileTreeNode,
  WorkspaceFolder,
  WorkspaceKind,
} from "@/types/workspace";

function demoTreeToNodes(nodes: DemoTreeNode[]): FileTreeNode[] {
  return nodes.map((node) => {
    if (node.kind === "folder") {
      return {
        name: basename(node.path),
        path: node.path,
        kind: "folder",
        children: demoTreeToNodes(node.children),
        loaded: true,
      };
    }
    return {
      name: basename(node.path),
      path: node.path,
      kind: "file",
    };
  });
}

function updateNodeChildren(
  nodes: FileTreeNode[],
  folderPath: string,
  children: FileTreeNode[],
): FileTreeNode[] {
  return nodes.map((node) => {
    if (node.path === folderPath && node.kind === "folder") {
      return { ...node, children, loaded: true };
    }
    if (node.kind === "folder" && node.children?.length) {
      return {
        ...node,
        children: updateNodeChildren(node.children, folderPath, children),
      };
    }
    return node;
  });
}

function collectLoadedFolders(nodes: FileTreeNode[], acc: string[] = []): string[] {
  for (const node of nodes) {
    if (node.kind === "folder" && node.loaded) {
      acc.push(node.path);
      if (node.children?.length) {
        collectLoadedFolders(node.children, acc);
      }
    }
  }
  return acc;
}

function findNode(
  nodes: FileTreeNode[],
  path: string,
): FileTreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const nested = findNode(node.children, path);
      if (nested) return nested;
    }
  }
  return null;
}

function normPath(path: string): string {
  return path.replace(/\//g, "\\").toLowerCase();
}

function pathsEqual(a: string, b: string): boolean {
  return normPath(a) === normPath(b);
}

function isUnderRoot(filePath: string, root: string): boolean {
  const a = normPath(filePath);
  const b = normPath(root);
  return a === b || a.startsWith(`${b}\\`) || a.startsWith(`${b}/`);
}

function compatFromFolders(
  folders: WorkspaceFolder[],
  activeFolderPath: string | null,
): {
  activeFolderPath: string | null;
  rootPath: string | null;
  rootName: string;
  tree: FileTreeNode[];
} {
  if (folders.length === 0) {
    return {
      activeFolderPath: null,
      rootPath: null,
      rootName: "No folder",
      tree: [],
    };
  }

  const active =
    folders.find((f) => f.path === activeFolderPath) ?? folders[0]!;
  const rootName =
    folders.length === 1
      ? workspaceLabel(active.path)
      : `${workspaceLabel(active.path)} +${folders.length - 1}`;

  return {
    activeFolderPath: active.path,
    rootPath: active.path,
    rootName,
    tree: active.tree,
  };
}

async function loadFolder(path: string): Promise<WorkspaceFolder> {
  const tree = await listDirectory(path);
  return {
    path,
    name: basename(path),
    tree,
  };
}

interface WorkspaceState {
  kind: WorkspaceKind;
  folders: WorkspaceFolder[];
  activeFolderPath: string | null;
  /** Active folder path (PIO / terminal / apply). Kept for existing consumers. */
  rootPath: string | null;
  rootName: string;
  /** Tree of the active folder (compat). Prefer `folders` in UI. */
  tree: FileTreeNode[];
  loading: boolean;
  error: string | null;
  openFolder: () => Promise<void>;
  addFolder: () => Promise<void>;
  /** Add an already-known folder path (no picker). Used by LoRa TX+RX pair. */
  addFolderAt: (path: string) => Promise<void>;
  removeFolder: (path: string) => void;
  setActiveFolder: (path: string) => void;
  openDemoWorkspace: () => void;
  closeWorkspace: () => void;
  expandFolder: (path: string) => Promise<void>;
  refreshTree: (rootHint?: string) => Promise<void>;
  reloadExternalFiles: (paths: string[]) => Promise<void>;
  openPathInEditor: (path: string) => Promise<void>;
  openFolderAt: (path: string) => Promise<void>;
  createFile: (parentDir: string, name: string) => Promise<string | null>;
  createFolder: (parentDir: string, name: string) => Promise<string | null>;
  renameEntry: (path: string, newName: string) => Promise<string | null>;
  deleteEntry: (path: string, isDirectory: boolean) => Promise<boolean>;
  resolveRelativePath: (relative: string) => string | null;
  folderPaths: () => string[];
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  kind: "none",
  folders: [],
  activeFolderPath: null,
  rootPath: null,
  rootName: "No folder",
  tree: [],
  loading: false,
  error: null,

  folderPaths: () => get().folders.map((f) => f.path),

  resolveRelativePath: (relative) => {
    const trimmed = relative.trim().replace(/^["']|["']$/g, "");
    if (!trimmed) return null;
    if (
      /^[A-Za-z]:[\\/]/.test(trimmed) ||
      trimmed.startsWith("/") ||
      trimmed.startsWith("\\\\")
    ) {
      return trimmed;
    }

    const { folders, activeFolderPath } = get();
    const ordered = [
      ...folders.filter((f) => f.path === activeFolderPath),
      ...folders.filter((f) => f.path !== activeFolderPath),
    ];

    // Prefer active root join; existence is checked by callers when needed.
    const active = ordered[0];
    if (!active) return null;
    const sep = active.path.includes("\\") ? "\\" : "/";
    const rel = trimmed.replace(/^\.[/\\]/, "");
    return `${active.path.replace(/[/\\]$/, "")}${sep}${rel}`;
  },

  openFolder: async () => {
    if (!isTauriRuntime()) {
      set({
        error:
          "Open Folder requires the desktop app. Run: npm run tauri:dev",
      });
      return;
    }

    set({ loading: true, error: null });

    try {
      const selected = await pickWorkspaceFolder();
      if (!selected) {
        set({ loading: false });
        return;
      }

      const folder = await loadFolder(selected);
      useEditorStore.getState().closeAllTabs();

      const folders = [folder];
      set({
        kind: "folder",
        folders,
        loading: false,
        error: null,
        ...compatFromFolders(folders, folder.path),
      });
    } catch (error) {
      set({
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to open folder.",
      });
    }
  },

  addFolder: async () => {
    if (!isTauriRuntime()) {
      set({
        error:
          "Add Folder requires the desktop app. Run: npm run tauri:dev",
      });
      return;
    }

    const { kind } = get();
    if (kind === "demo") {
      set({ error: "Close the demo workspace before adding folders." });
      return;
    }

    set({ loading: true, error: null });

    try {
      const selected = await pickWorkspaceFolder();
      if (!selected) {
        set({ loading: false });
        return;
      }
      await get().addFolderAt(selected);
    } catch (error) {
      set({
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to add folder.",
      });
    }
  },

  addFolderAt: async (path) => {
    if (!isTauriRuntime()) {
      set({
        error:
          "Add Folder requires the desktop app. Run: npm run tauri:dev",
      });
      return;
    }

    const { kind } = get();
    if (kind === "demo") {
      set({ error: "Close the demo workspace before adding folders." });
      return;
    }

    const selected = path.trim();
    if (!selected) return;

    set({ loading: true, error: null });

    try {
      const existing = get().folders;
      if (existing.some((f) => pathsEqual(f.path, selected))) {
        set({ loading: false, error: null });
        return;
      }

      for (const f of existing) {
        if (isUnderRoot(selected, f.path) || isUnderRoot(f.path, selected)) {
          set({
            loading: false,
            error: "Folder overlaps an existing workspace root.",
          });
          return;
        }
      }

      const folder = await loadFolder(selected);
      const folders = [...existing, folder];
      const active = get().activeFolderPath ?? folder.path;

      set({
        kind: "folder",
        folders,
        loading: false,
        error: null,
        ...compatFromFolders(folders, active),
      });
    } catch (error) {
      set({
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to add folder.",
      });
    }
  },

  removeFolder: (path) => {
    const { folders, activeFolderPath, kind } = get();
    if (kind !== "folder") return;

    const next = folders.filter((f) => !pathsEqual(f.path, path));
    if (next.length === 0) {
      useEditorStore.getState().closeAllTabs();
      set({
        kind: "none",
        folders: [],
        loading: false,
        error: null,
        ...compatFromFolders([], null),
      });
      return;
    }

    const activeStill =
      activeFolderPath && next.some((f) => pathsEqual(f.path, activeFolderPath))
        ? activeFolderPath
        : next[0]!.path;

    set({
      folders: next,
      error: null,
      ...compatFromFolders(next, activeStill),
    });
  },

  setActiveFolder: (path) => {
    const { folders, kind } = get();
    if (kind !== "folder") return;
    if (!folders.some((f) => pathsEqual(f.path, path))) return;
    set({
      ...compatFromFolders(folders, path),
      error: null,
    });
  },

  openDemoWorkspace: () => {
    useEditorStore.getState().closeAllTabs();
    const tree = demoTreeToNodes(DEMO_TREE);
    set({
      kind: "demo",
      folders: [],
      activeFolderPath: null,
      rootPath: null,
      rootName: "DEMO WORKSPACE",
      tree,
      loading: false,
      error: null,
    });
  },

  closeWorkspace: () => {
    useEditorStore.getState().closeAllTabs();
    set({
      kind: "none",
      folders: [],
      loading: false,
      error: null,
      ...compatFromFolders([], null),
    });
  },

  expandFolder: async (path) => {
    const { kind, folders, tree, activeFolderPath } = get();

    if (kind === "demo") return;

    if (kind !== "folder") return;

    // Search which root owns this path
    let ownerIndex = folders.findIndex((f) => findNode(f.tree, path));
    if (ownerIndex === -1) {
      // Might be a direct child listing under a root that matches path prefix
      ownerIndex = folders.findIndex((f) => isUnderRoot(path, f.path));
    }
    if (ownerIndex === -1) return;

    const owner = folders[ownerIndex]!;
    const target = findNode(owner.tree, path);
    if (!target || target.kind !== "folder" || target.loaded) {
      return;
    }

    try {
      const children = await listDirectory(path);
      const nextFolders = folders.map((f, i) =>
        i === ownerIndex
          ? { ...f, tree: updateNodeChildren(f.tree, path, children) }
          : f,
      );
      set({
        folders: nextFolders,
        error: null,
        ...compatFromFolders(nextFolders, activeFolderPath),
      });
      // Keep demo-style single tree in sync when expanding active
      void tree;
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Failed to read folder.",
      });
    }
  },

  refreshTree: async (rootHint) => {
    const { kind, folders, activeFolderPath } = get();
    if (kind !== "folder" || folders.length === 0) return;

    const targets = rootHint
      ? folders.filter((f) => pathsEqual(f.path, rootHint))
      : folders;
    if (targets.length === 0) return;

    try {
      const refreshed = await Promise.all(
        folders.map(async (folder) => {
          if (
            rootHint &&
            !pathsEqual(folder.path, rootHint)
          ) {
            return folder;
          }
          const loaded = collectLoadedFolders(folder.tree);
          let next = await listDirectory(folder.path);
          for (const folderPath of loaded) {
            if (pathsEqual(folderPath, folder.path)) continue;
            try {
              const children = await listDirectory(folderPath);
              next = updateNodeChildren(next, folderPath, children);
            } catch {
              // removed
            }
          }
          return { ...folder, tree: next };
        }),
      );

      set({
        folders: refreshed,
        error: null,
        ...compatFromFolders(refreshed, activeFolderPath),
      });
    } catch {
      // Ignore transient FS errors during watch bursts.
    }
  },

  reloadExternalFiles: async (paths) => {
    const { kind } = get();
    if (kind !== "folder" || paths.length === 0) return;

    const tabs = useEditorStore.getState().tabs;
    for (const tab of tabs) {
      if (tab.dirty) continue;
      const hit = paths.some((p) => pathsEqual(p, tab.path));
      if (!hit) continue;
      try {
        const content = await readWorkspaceTextFile(tab.path);
        useEditorStore.getState().replaceContentFromDisk(tab.path, content);
      } catch {
        // deleted
      }
    }
  },

  openPathInEditor: async (path) => {
    const { kind } = get();

    if (kind === "demo") {
      const demo = resolveDemoFile(path);
      if (!demo) {
        set({ error: `File not found: ${path}` });
        return;
      }
      useEditorStore.getState().openFile(demo);
      return;
    }

    if (kind !== "folder") return;

    try {
      const content = await readWorkspaceTextFile(path);
      const { isEncryptedPayload } = await import("@/lib/sketchCrypto");
      if (isEncryptedPayload(content)) {
        // Defer open until password unlock (handled by pending unlock UI).
        const { useUnlockStore } = await import("@/stores/unlockStore");
        useUnlockStore.getState().requestUnlock(path, content);
        set({ error: null });
        return;
      }
      useEditorStore.getState().openFile({ path, content, encrypted: false });

      // Focus the owning root as active when opening a file from it.
      const owner = get().folders.find((f) => isUnderRoot(path, f.path));
      if (owner) {
        set({
          error: null,
          ...compatFromFolders(get().folders, owner.path),
        });
      } else {
        set({ error: null });
      }
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to open file.",
      });
    }
  },

  openFolderAt: async (path) => {
    if (!isTauriRuntime()) {
      set({
        error:
          "Open Folder requires the desktop app. Run: npm run tauri:dev",
      });
      return;
    }

    set({ loading: true, error: null });
    try {
      const folder = await loadFolder(path);
      useEditorStore.getState().closeAllTabs();
      const folders = [folder];
      set({
        kind: "folder",
        folders,
        loading: false,
        error: null,
        ...compatFromFolders(folders, folder.path),
      });
    } catch (error) {
      set({
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to open folder.",
      });
    }
  },

  createFile: async (parentDir, name) => {
    if (get().kind !== "folder") {
      set({ error: "Open a folder workspace first." });
      return null;
    }
    try {
      const path = await createWorkspaceFile(parentDir, name, "");
      await get().refreshTree();
      await get().openPathInEditor(path);
      return path;
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to create file.",
      });
      return null;
    }
  },

  createFolder: async (parentDir, name) => {
    if (get().kind !== "folder") {
      set({ error: "Open a folder workspace first." });
      return null;
    }
    try {
      const path = await createWorkspaceFolder(parentDir, name);
      await get().refreshTree();
      return path;
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Failed to create folder.",
      });
      return null;
    }
  },

  renameEntry: async (path, newName) => {
    if (get().kind !== "folder") return null;
    try {
      const next = await renameWorkspacePath(path, newName);
      useEditorStore.getState().renameTabPath(path, next);
      // If a workspace root was renamed, update folder list.
      const folders = get().folders;
      const rootHit = folders.find((f) => pathsEqual(f.path, path));
      if (rootHit) {
        const refreshed = await Promise.all(
          folders.map(async (f) =>
            pathsEqual(f.path, path)
              ? await loadFolder(next)
              : f,
          ),
        );
        const active = pathsEqual(get().activeFolderPath ?? "", path)
          ? next
          : get().activeFolderPath;
        set({
          folders: refreshed,
          error: null,
          ...compatFromFolders(refreshed, active),
        });
      } else {
        await get().refreshTree();
        // Refresh parent so rename shows immediately
        const parent = dirname(path);
        void parent;
      }
      return next;
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to rename.",
      });
      return null;
    }
  },

  deleteEntry: async (path, isDirectory) => {
    if (get().kind !== "folder") return false;
    if (get().folders.some((f) => pathsEqual(f.path, path))) {
      set({ error: "Remove the folder from the workspace instead of deleting the root." });
      return false;
    }
    try {
      await deleteWorkspacePath(path, isDirectory);
      useEditorStore.getState().closeTabsUnder(path);
      await get().refreshTree();
      set({ error: null });
      return true;
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to delete.",
      });
      return false;
    }
  },
}));
