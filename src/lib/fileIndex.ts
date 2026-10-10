import { listDirectory } from "@/lib/fsWorkspace";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { FileTreeNode } from "@/types/workspace";

export interface FileIndexEntry {
  path: string;
  name: string;
  relative: string;
}

function collectFromTree(
  nodes: FileTreeNode[],
  rootPath: string,
  acc: FileIndexEntry[],
): void {
  for (const node of nodes) {
    if (node.kind === "file") {
      const relative = node.path.startsWith(rootPath)
        ? node.path.slice(rootPath.length).replace(/^[/\\]/, "")
        : node.name;
      acc.push({ path: node.path, name: node.name, relative });
    } else if (node.children?.length) {
      collectFromTree(node.children, rootPath, acc);
    }
  }
}

/** Sync index from currently loaded explorer trees. */
export function indexLoadedFiles(): FileIndexEntry[] {
  const { kind, folders } = useWorkspaceStore.getState();
  if (kind !== "folder") return [];
  const acc: FileIndexEntry[] = [];
  for (const folder of folders) {
    collectFromTree(folder.tree, folder.path, acc);
  }
  return acc;
}

/**
 * Expand shallow unloaded folders (one level) to improve Quick Open coverage
 * without a full recursive walk.
 */
export async function expandFileIndex(
  base: FileIndexEntry[],
): Promise<FileIndexEntry[]> {
  const { kind, folders } = useWorkspaceStore.getState();
  if (kind !== "folder") return base;

  const seen = new Set(base.map((b) => b.path.replace(/\//g, "\\").toLowerCase()));
  const out = [...base];

  async function walk(nodes: FileTreeNode[], rootPath: string, depth: number) {
    for (const node of nodes) {
      if (node.kind === "file") {
        const key = node.path.replace(/\//g, "\\").toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          const relative = node.path.startsWith(rootPath)
            ? node.path.slice(rootPath.length).replace(/^[/\\]/, "")
            : node.name;
          out.push({ path: node.path, name: node.name, relative });
        }
        continue;
      }
      if (depth >= 2) continue;
      let children = node.children ?? [];
      if (!node.loaded) {
        try {
          children = await listDirectory(node.path);
        } catch {
          continue;
        }
      }
      await walk(children, rootPath, depth + 1);
    }
  }

  for (const folder of folders) {
    await walk(folder.tree, folder.path, 0);
    // Also list root if tree was empty / not fully loaded
    try {
      const rootChildren = await listDirectory(folder.path);
      await walk(rootChildren, folder.path, 0);
    } catch {
      /* ignore */
    }
  }

  return out;
}
