import type { FileTreeNode } from "@/types/workspace";
import { joinPath } from "@/lib/paths";

/** Names/folders hidden or de-emphasized in Sketch mode. */
const CLUTTER_NAMES = new Set([
  ".pio",
  ".git",
  "libdeps",
  "node_modules",
  ".vscode",
  ".idea",
  "__pycache__",
]);

const SECONDARY_NAMES = new Set(["platformio.ini", "README.md", "README"]);

export function isClutterName(name: string): boolean {
  const lower = name.toLowerCase();
  return CLUTTER_NAMES.has(name) || CLUTTER_NAMES.has(lower) || lower === "libdeps";
}

export function isSecondaryName(name: string): boolean {
  return SECONDARY_NAMES.has(name) || SECONDARY_NAMES.has(name.toLowerCase());
}

/** Prefer src/main.cpp, then any src/*.ino, then root *.ino. */
export function findMainSketchPath(
  rootPath: string,
  tree: FileTreeNode[],
): string | null {
  const src = tree.find(
    (n) => n.kind === "folder" && n.name.toLowerCase() === "src",
  );
  if (src?.children) {
    const mainCpp = src.children.find(
      (n) =>
        n.kind === "file" &&
        (n.name.toLowerCase() === "main.cpp" ||
          n.name.toLowerCase() === "main.c"),
    );
    if (mainCpp) return mainCpp.path;

    const ino = src.children.find(
      (n) => n.kind === "file" && n.name.toLowerCase().endsWith(".ino"),
    );
    if (ino) return ino.path;
  }

  const rootIno = tree.find(
    (n) => n.kind === "file" && n.name.toLowerCase().endsWith(".ino"),
  );
  if (rootIno) return rootIno.path;

  // Fallback when tree not expanded yet
  return joinPath(joinPath(rootPath, "src"), "main.cpp");
}

export function isMainSketchPath(filePath: string, rootPath: string): boolean {
  const norm = filePath.replace(/\\/g, "/").toLowerCase();
  const root = rootPath.replace(/\\/g, "/").toLowerCase().replace(/\/$/, "");
  if (norm === `${root}/src/main.cpp` || norm === `${root}/src/main.c`) {
    return true;
  }
  if (norm.startsWith(`${root}/src/`) && norm.endsWith(".ino")) return true;
  const base = norm.slice(root.length + 1);
  return !base.includes("/") && base.endsWith(".ino");
}

/** Filter file tree for Sketch mode: hide clutter, keep src + secondary + main. */
export function filterTreeForSketchMode(
  nodes: FileTreeNode[],
  showAll: boolean,
): FileTreeNode[] {
  if (showAll) return nodes;

  return nodes
    .filter((n) => !isClutterName(n.name))
    .map((n) => {
      if (n.kind === "folder" && n.children) {
        // Keep src contents; for other folders, hide deep clutter only
        if (n.name.toLowerCase() === "src") {
          return {
            ...n,
            children: n.children.filter((c) => !isClutterName(c.name)),
          };
        }
        if (n.name.toLowerCase() === "lib" || n.name.toLowerCase() === "include") {
          return {
            ...n,
            children: filterTreeForSketchMode(n.children, false),
          };
        }
        // Collapse other folders' children in sketch view (still show the folder)
        return { ...n, children: [], loaded: true };
      }
      return n;
    });
}

/** Sort so main sketch + src appear first, platformio.ini secondary. */
export function sortTreeForSketchMode(nodes: FileTreeNode[]): FileTreeNode[] {
  const rank = (n: FileTreeNode): number => {
    if (n.kind === "folder" && n.name.toLowerCase() === "src") return 0;
    if (
      n.kind === "file" &&
      (n.name.toLowerCase() === "main.cpp" ||
        n.name.toLowerCase().endsWith(".ino"))
    ) {
      return 1;
    }
    if (isSecondaryName(n.name)) return 3;
    if (isClutterName(n.name)) return 9;
    return 2;
  };
  return [...nodes].sort((a, b) => {
    const d = rank(a) - rank(b);
    if (d !== 0) return d;
    return a.name.localeCompare(b.name);
  });
}
