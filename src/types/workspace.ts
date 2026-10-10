export type WorkspaceKind = "none" | "demo" | "folder";

export interface FileTreeNode {
  name: string;
  path: string;
  kind: "file" | "folder";
  /** Present for folders; empty until expanded/loaded. */
  children?: FileTreeNode[];
  loaded?: boolean;
}

/** One root folder in a multi-root workspace. */
export interface WorkspaceFolder {
  path: string;
  name: string;
  tree: FileTreeNode[];
}

export interface OpenFileInput {
  path: string;
  content: string;
  language?: import("@/types/editor").EditorLanguage;
}
