import {
  applyCodeBlock,
  extractCodeBlocks,
  resolveApplyPath,
  writeEditorContent,
  type CodeBlock,
} from "@/lib/applyEdit";
import { readWorkspaceTextFile } from "@/lib/fsWorkspace";
import { useEditorStore } from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export type AgentEditKind = "full" | "search-replace" | "unified-diff";

export interface AgentEdit {
  id: string;
  kind: AgentEditKind;
  /** Display path (may be relative) */
  pathLabel: string | null;
  /** Resolved absolute path when known */
  path: string | null;
  /** Full-file body (kind=full) */
  fullContent?: string;
  search?: string;
  replace?: string;
  /** Raw unified diff text */
  diff?: string;
  language?: string;
}

export interface EditPreview {
  path: string;
  original: string;
  next: string;
  summary: string;
  /** Short line-oriented preview for UI */
  removed: string[];
  added: string[];
}

const SEARCH_REPLACE_RE =
  /(?:^|\n)(?:(?:#{1,3}\s*)?(?:File|Path)\s*:\s*([^\n]+)\n)?<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;

async function loadFileContent(path: string): Promise<string> {
  const tab = useEditorStore.getState().tabs.find((t) => t.path === path);
  if (tab) return tab.content;

  const kind = useWorkspaceStore.getState().kind;
  if (kind === "folder") {
    return readWorkspaceTextFile(path);
  }
  throw new Error(`File not open: ${path}`);
}

function normalizeEol(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function applySearchReplace(
  original: string,
  search: string,
  replace: string,
): string {
  const src = normalizeEol(original);
  const needle = normalizeEol(search);
  const rep = normalizeEol(replace);

  if (src.includes(needle)) {
    return src.replace(needle, rep);
  }

  // Try trimmed-line fuzzy match for common LLM whitespace drift
  const srcLines = src.split("\n");
  const needleLines = needle.split("\n");
  if (needleLines.length === 0) {
    throw new Error("Empty SEARCH block.");
  }

  const trim = (s: string) => s.trimEnd();
  outer: for (let i = 0; i <= srcLines.length - needleLines.length; i++) {
    for (let j = 0; j < needleLines.length; j++) {
      if (trim(srcLines[i + j]!) !== trim(needleLines[j]!)) {
        continue outer;
      }
    }
    const before = srcLines.slice(0, i);
    const after = srcLines.slice(i + needleLines.length);
    const repLines = rep.split("\n");
    // Drop trailing empty from replace split artifact if search had none
    return [...before, ...repLines, ...after].join("\n");
  }

  throw new Error("SEARCH block not found in file (exact or trimmed match).");
}

/** Minimal unified-diff applier for single-file text patches. */
function applyUnifiedDiff(original: string, diffText: string): string {
  const srcLines = normalizeEol(original).split("\n");
  const lines = normalizeEol(diffText).split("\n");
  const hunks: { oldStart: number; lines: string[] }[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const m = line.match(/^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s@@/);
    if (!m) {
      i += 1;
      continue;
    }
    const oldStart = Number(m[1]);
    i += 1;
    const hunkLines: string[] = [];
    while (i < lines.length && !lines[i]!.startsWith("@@")) {
      const hl = lines[i]!;
      if (
        hl.startsWith("---") ||
        hl.startsWith("+++") ||
        hl.startsWith("diff ") ||
        hl.startsWith("index ")
      ) {
        break;
      }
      hunkLines.push(hl);
      i += 1;
    }
    hunks.push({ oldStart, lines: hunkLines });
  }

  if (hunks.length === 0) {
    throw new Error("No hunks found in unified diff.");
  }

  // Apply from bottom so line numbers stay valid
  let result = [...srcLines];
  for (const hunk of [...hunks].reverse()) {
    let oldIdx = hunk.oldStart - 1;
    const out: string[] = [];
    const expected: string[] = [];

    for (const hl of hunk.lines) {
      if (hl.startsWith("\\")) continue; // "\ No newline at end of file"
      const tag = hl[0];
      const body = hl.length > 0 ? hl.slice(1) : "";
      if (tag === " " || tag === undefined) {
        expected.push(body);
        out.push(body);
        oldIdx += 1;
      } else if (tag === "-") {
        expected.push(body);
        oldIdx += 1;
      } else if (tag === "+") {
        out.push(body);
      } else {
        // malformed — treat as context
        expected.push(hl);
        out.push(hl);
        oldIdx += 1;
      }
    }

    const start = hunk.oldStart - 1;
    const end = start + expected.length;
    const slice = result.slice(start, end);
    const matchExact = slice.join("\n") === expected.join("\n");
    const matchTrim =
      slice.length === expected.length &&
      slice.every((l, idx) => l.trimEnd() === expected[idx]!.trimEnd());

    if (!matchExact && !matchTrim) {
      throw new Error(
        `Diff hunk at line ${hunk.oldStart} does not match file content.`,
      );
    }
    result = [...result.slice(0, start), ...out, ...result.slice(end)];
  }

  return result.join("\n");
}

function parsePathFromDiff(diffText: string): string | null {
  const plus = diffText.match(/^\+\+\+\s+(?:b\/)?(.+)$/m);
  if (plus?.[1] && plus[1] !== "/dev/null") {
    return plus[1].trim();
  }
  const minus = diffText.match(/^---\s+(?:a\/)?(.+)$/m);
  if (minus?.[1] && minus[1] !== "/dev/null") {
    return minus[1].trim();
  }
  return null;
}

function looksLikeUnifiedDiff(code: string): boolean {
  return (
    /^diff --git /m.test(code) ||
    /^@@\s+-\d+/m.test(code) ||
    (/^---\s+/m.test(code) && /^\+\+\+\s+/m.test(code))
  );
}

function looksLikeSearchReplace(code: string): boolean {
  return (
    code.includes("<<<<<<< SEARCH") &&
    code.includes("=======") &&
    code.includes(">>>>>>> REPLACE")
  );
}

function lineDiffPreview(
  original: string,
  next: string,
): { removed: string[]; added: string[] } {
  const a = normalizeEol(original).split("\n");
  const b = normalizeEol(next).split("\n");
  // Simple LCS-free: show first differing window
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) {
    start += 1;
  }
  let endA = a.length - 1;
  let endB = b.length - 1;
  while (endA >= start && endB >= start && a[endA] === b[endB]) {
    endA -= 1;
    endB -= 1;
  }
  const removed = a.slice(start, endA + 1).slice(0, 40);
  const added = b.slice(start, endB + 1).slice(0, 40);
  return { removed, added };
}

export function extractAgentEdits(content: string): AgentEdit[] {
  const edits: AgentEdit[] = [];
  let seq = 0;
  const coveredRanges: Array<{ start: number; end: number }> = [];

  // 1) Bare SEARCH/REPLACE (optionally with File: header)
  const srRe = new RegExp(SEARCH_REPLACE_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = srRe.exec(content)) !== null) {
    const pathLabel = m[1]?.trim() || null;
    const search = m[2] ?? "";
    const replace = m[3] ?? "";
    coveredRanges.push({ start: m.index, end: m.index + m[0].length });
    edits.push({
      id: `sr-${seq++}`,
      kind: "search-replace",
      pathLabel,
      path: resolveApplyPath(pathLabel),
      search,
      replace,
    });
  }

  // 2) Fenced blocks
  const blocks = extractCodeBlocks(content);
  for (const block of blocks) {
    // Skip fences fully inside a SEARCH/REPLACE we already captured
    if (
      coveredRanges.some(
        (r) => block.start >= r.start && block.end <= r.end,
      )
    ) {
      continue;
    }

    if (
      looksLikeSearchReplace(block.code) ||
      block.language.toLowerCase() === "search-replace"
    ) {
      const inner = new RegExp(SEARCH_REPLACE_RE.source, "g");
      let im: RegExpExecArray | null;
      let any = false;
      while ((im = inner.exec(`\n${block.code}`)) !== null) {
        any = true;
        const pathLabel = im[1]?.trim() || block.path;
        edits.push({
          id: `sr-${seq++}`,
          kind: "search-replace",
          pathLabel,
          path: resolveApplyPath(pathLabel),
          search: im[2] ?? "",
          replace: im[3] ?? "",
          language: block.language,
        });
      }
      if (any) continue;
    }

    if (
      looksLikeUnifiedDiff(block.code) ||
      block.language.toLowerCase() === "diff" ||
      block.language.toLowerCase() === "patch"
    ) {
      const pathLabel = block.path ?? parsePathFromDiff(block.code);
      edits.push({
        id: `diff-${seq++}`,
        kind: "unified-diff",
        pathLabel,
        path: resolveApplyPath(pathLabel),
        diff: block.code,
        language: block.language,
      });
      continue;
    }

    // Full-file replace (existing behavior) — prefer when path present
    if (block.path || block.code.split("\n").length > 2) {
      edits.push({
        id: block.id,
        kind: "full",
        pathLabel: block.path,
        path: resolveApplyPath(block.path),
        fullContent: block.code,
        language: block.language,
      });
    }
  }

  return edits;
}

export async function previewAgentEdit(edit: AgentEdit): Promise<EditPreview> {
  if (edit.kind === "full") {
    const path = edit.path ?? resolveApplyPath(edit.pathLabel);
    if (!path) {
      throw new Error("Open a file first, or include a path in the edit.");
    }
    let original = "";
    try {
      original = await loadFileContent(path);
    } catch {
      original = "";
    }
    const next = edit.fullContent ?? "";
    const { removed, added } = lineDiffPreview(original, next);
    return {
      path,
      original,
      next,
      summary: original
        ? "Replace entire file"
        : "Create / write entire file",
      removed,
      added,
    };
  }

  const path = edit.path ?? resolveApplyPath(edit.pathLabel);
  if (!path) {
    throw new Error("Include a file path for this partial edit.");
  }
  const original = await loadFileContent(path);

  let next: string;
  let summary: string;
  if (edit.kind === "search-replace") {
    next = applySearchReplace(original, edit.search ?? "", edit.replace ?? "");
    summary = "SEARCH / REPLACE patch";
  } else {
    next = applyUnifiedDiff(original, edit.diff ?? "");
    summary = "Unified diff patch";
  }

  const { removed, added } = lineDiffPreview(original, next);
  return { path, original, next, summary, removed, added };
}

export async function applyAgentEdit(edit: AgentEdit): Promise<string> {
  if (edit.kind === "full") {
    const block: CodeBlock = {
      id: edit.id,
      language: edit.language ?? "",
      path: edit.pathLabel,
      code: edit.fullContent ?? "",
      start: 0,
      end: 0,
    };
    return applyCodeBlock(block);
  }

  const preview = await previewAgentEdit(edit);
  await writeEditorContent(preview.path, preview.next);
  return preview.path;
}

export function editButtonLabel(edit: AgentEdit, index: number, total: number): string {
  const n = total > 1 ? ` #${index + 1}` : "";
  const target = edit.pathLabel ?? "active file";
  if (edit.kind === "search-replace") return `Patch${n} → ${target}`;
  if (edit.kind === "unified-diff") return `Diff${n} → ${target}`;
  return `Apply${n} → ${target}`;
}
