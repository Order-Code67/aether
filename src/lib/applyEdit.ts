import { joinPath } from "@/lib/paths";
import { writeWorkspaceTextFile } from "@/lib/fsWorkspace";
import { useEditorStore } from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export interface CodeBlock {
  id: string;
  language: string;
  /** Relative or absolute path when present in the fence info */
  path: string | null;
  code: string;
  start: number;
  end: number;
}

const FENCE_RE = /```([^\n`]*)\n([\s\S]*?)```/g;

const LANGS = new Set([
  "c",
  "cc",
  "cpp",
  "cxx",
  "h",
  "hpp",
  "ino",
  "rs",
  "py",
  "js",
  "ts",
  "tsx",
  "json",
  "toml",
  "ini",
  "md",
  "txt",
  "cmake",
  "makefile",
  "sh",
  "bash",
  "powershell",
  "diff",
  "patch",
  "text",
  "plain",
  "search-replace",
]);

function parseFenceInfo(info: string): { language: string; path: string | null } {
  const trimmed = info.trim();
  if (!trimmed) return { language: "", path: null };

  const pathEq = trimmed.match(/(?:^|\s)path=([^\s]+)/i);
  if (pathEq?.[1]) {
    const language = trimmed.split(/\s+/)[0]?.replace(/^path=.*/i, "") ?? "";
    return {
      language: LANGS.has(language.toLowerCase()) ? language : "",
      path: pathEq[1],
    };
  }

  const colon = trimmed.match(/^([A-Za-z0-9_+-]+):(.+)$/);
  if (colon?.[1] && colon[2] && /[/\\.]/.test(colon[2])) {
    return { language: colon[1], path: colon[2].trim() };
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && /[/\\.]/.test(parts[parts.length - 1]!)) {
    const path = parts[parts.length - 1]!;
    const language = parts.slice(0, -1).join(" ");
    return { language, path };
  }

  if (parts.length === 1) {
    const only = parts[0]!;
    if (/[/\\]/.test(only) || /\.\w+$/.test(only)) {
      return { language: "", path: only };
    }
    return { language: only, path: null };
  }

  return { language: trimmed, path: null };
}

export function extractCodeBlocks(content: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(FENCE_RE.source, "g");
  let index = 0;

  while ((match = re.exec(content)) !== null) {
    const info = match[1] ?? "";
    const code = (match[2] ?? "").replace(/\n$/, "");
    if (!code.trim()) continue;
    const { language, path } = parseFenceInfo(info);
    blocks.push({
      id: `block-${index++}`,
      language,
      path,
      code,
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return blocks;
}

function activeTabPath(): string | null {
  const editor = useEditorStore.getState();
  const tab = editor.tabs.find((t) => t.id === editor.activeTabId);
  return tab?.path ?? null;
}

export function resolveApplyPath(path: string | null): string | null {
  if (!path) {
    return activeTabPath();
  }

  if (
    /^[A-Za-z]:[\\/]/.test(path) ||
    path.startsWith("/") ||
    path.startsWith("\\\\")
  ) {
    return path;
  }

  const resolved = useWorkspaceStore.getState().resolveRelativePath(path);
  if (resolved) return resolved;

  const root = useWorkspaceStore.getState().rootPath;
  if (!root) {
    return activeTabPath();
  }
  return joinPath(root, path.replace(/^\.[/\\]/, ""));
}

/** Write content into editor tab (+ disk when workspace folder). */
export async function writeEditorContent(
  path: string,
  content: string,
): Promise<void> {
  const editor = useEditorStore.getState();
  const existing = editor.tabs.find((t) => t.path === path);

  if (existing) {
    editor.updateContent(existing.id, content);
    editor.setActiveTab(existing.id);
  } else {
    editor.openFile({ path, content });
  }

  const kind = useWorkspaceStore.getState().kind;
  if (kind === "folder") {
    await writeWorkspaceTextFile(path, content);
    const tab = useEditorStore.getState().tabs.find((t) => t.path === path);
    if (tab) {
      useEditorStore.getState().markClean(tab.id);
    }
  }
}

/**
 * Apply a code block to the editor (and disk for workspace files).
 * Path-less blocks replace the active tab.
 */
export async function applyCodeBlock(block: CodeBlock): Promise<string> {
  const target = resolveApplyPath(block.path);
  if (!target) {
    throw new Error("Open a file first, or include a path in the code fence.");
  }
  await writeEditorContent(target, block.code);
  return target;
}
