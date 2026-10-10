import { open } from "@tauri-apps/plugin-dialog";
import {
  exists,
  mkdir,
  readDir,
  readTextFile,
  remove,
  rename,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import type { FileTreeNode } from "@/types/workspace";
import { dirname, isValidEntryName, joinPath } from "@/lib/paths";

const IGNORED_NAMES = new Set([
  ".git",
  ".svn",
  ".hg",
  "node_modules",
  "dist",
  "build",
  "out",
  "target",
  ".next",
  ".nuxt",
  ".cache",
  "__pycache__",
  ".pio",
  ".vscode",
  ".idea",
  "coverage",
]);

const BINARY_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "ico",
  "bmp",
  "pdf",
  "zip",
  "7z",
  "rar",
  "gz",
  "tar",
  "exe",
  "dll",
  "so",
  "dylib",
  "bin",
  "elf",
  "hex",
  "o",
  "a",
  "lib",
  "wasm",
  "mp3",
  "mp4",
  "wav",
  "avi",
  "mov",
  "woff",
  "woff2",
  "ttf",
  "otf",
  "class",
  "pyc",
]);

const MAX_FILE_BYTES = 2 * 1024 * 1024;

export function shouldIgnoreName(name: string): boolean {
  return IGNORED_NAMES.has(name) || name === ".DS_Store";
}

export function isLikelyBinaryPath(path: string): boolean {
  const ext = path.includes(".")
    ? path.slice(path.lastIndexOf(".") + 1).toLowerCase()
    : "";
  return BINARY_EXTENSIONS.has(ext);
}

function sortNodes(a: FileTreeNode, b: FileTreeNode): number {
  if (a.kind !== b.kind) {
    return a.kind === "folder" ? -1 : 1;
  }
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export async function pickWorkspaceFolder(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Open Folder",
  });

  return typeof selected === "string" ? selected : null;
}

export async function listDirectory(path: string): Promise<FileTreeNode[]> {
  const entries = await readDir(path);
  const nodes: FileTreeNode[] = [];

  for (const entry of entries) {
    if (!entry.name || shouldIgnoreName(entry.name)) continue;

    const childPath = joinPath(path, entry.name);
    if (entry.isDirectory) {
      nodes.push({
        name: entry.name,
        path: childPath,
        kind: "folder",
        children: [],
        loaded: false,
      });
    } else if (entry.isFile) {
      nodes.push({
        name: entry.name,
        path: childPath,
        kind: "file",
      });
    }
  }

  return nodes.sort(sortNodes);
}

export async function readWorkspaceTextFile(path: string): Promise<string> {
  if (isLikelyBinaryPath(path)) {
    throw new Error("Binary files are not supported in the editor yet.");
  }

  const content = await readTextFile(path);
  // Approximate size guard for very large text files
  if (content.length > MAX_FILE_BYTES) {
    throw new Error("File is too large to open (> 2 MB).");
  }

  return content;
}

export async function writeWorkspaceTextFile(
  path: string,
  content: string,
): Promise<void> {
  if (isLikelyBinaryPath(path)) {
    throw new Error("Binary files are not supported in the editor yet.");
  }

  await writeTextFile(path, content);
}

export async function pathExists(path: string): Promise<boolean> {
  return exists(path);
}

export async function createWorkspaceFile(
  parentDir: string,
  name: string,
  content = "",
): Promise<string> {
  if (!isValidEntryName(name)) {
    throw new Error("Invalid file name.");
  }
  const path = joinPath(parentDir, name.trim());
  if (await exists(path)) {
    throw new Error("A file or folder with that name already exists.");
  }
  await writeTextFile(path, content);
  return path;
}

export async function createWorkspaceFolder(
  parentDir: string,
  name: string,
): Promise<string> {
  if (!isValidEntryName(name)) {
    throw new Error("Invalid folder name.");
  }
  const path = joinPath(parentDir, name.trim());
  if (await exists(path)) {
    throw new Error("A file or folder with that name already exists.");
  }
  await mkdir(path, { recursive: false });
  return path;
}

export async function renameWorkspacePath(
  oldPath: string,
  newName: string,
): Promise<string> {
  if (!isValidEntryName(newName)) {
    throw new Error("Invalid name.");
  }
  const parent = dirname(oldPath);
  if (!parent || parent === oldPath) {
    throw new Error("Cannot rename this path.");
  }
  const newPath = joinPath(parent, newName.trim());
  if (await exists(newPath)) {
    throw new Error("A file or folder with that name already exists.");
  }
  await rename(oldPath, newPath);
  return newPath;
}

export async function deleteWorkspacePath(
  path: string,
  isDirectory: boolean,
): Promise<void> {
  await remove(path, { recursive: isDirectory });
}

export async function pickParentFolder(
  title = "Choose parent folder",
): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title,
  });
  return typeof selected === "string" ? selected : null;
}
