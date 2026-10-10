import { joinPath } from "@/lib/paths";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Problem, ProblemSeverity } from "@/types/problems";

/** GCC / Clang / PlatformIO toolchain diagnostics */
const GCC_LINE =
  /^(.+?):(\d+)(?::(\d+))?:\s*(fatal error|error|warning|note):\s*(.+)$/i;

/** MSVC-style: file(line[,col]): error C1234: message */
const MSVC_LINE =
  /^(.+?)\((\d+)(?:,(\d+))?\)\s*:\s*(fatal error|error|warning|note)\s*(?:[A-Z]\d+)?:\s*(.+)$/i;

function severityOf(kind: string): ProblemSeverity {
  const k = kind.toLowerCase();
  if (k.includes("error")) return "error";
  if (k.includes("warning")) return "warning";
  return "info";
}

function looksLikePath(file: string): boolean {
  if (!file || file.length > 512) return false;
  if (file.includes("://")) return false;
  // Require a path-ish token (slash, drive, or source extension)
  return (
    /[/\\]/.test(file) ||
    /^[A-Za-z]:/.test(file) ||
    /\.(c|cc|cpp|cxx|h|hpp|hxx|ino|s|S|asm|ld|lds)$/i.test(file)
  );
}

function isAbsolutePath(file: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(file) || file.startsWith("/") || file.startsWith("\\\\");
}

export function resolveProblemPath(
  file: string,
  workspaceRoot: string | null,
): string | null {
  const trimmed = file.trim().replace(/^["']|["']$/g, "");
  if (!trimmed) return null;
  if (isAbsolutePath(trimmed)) return trimmed;

  // Multi-root: prefer workspace store resolver (active root first).
  const fromStore = useWorkspaceStore.getState().resolveRelativePath(trimmed);
  if (fromStore) return fromStore;

  if (!workspaceRoot) return null;
  return joinPath(workspaceRoot, trimmed.replace(/^\.[/\\]/, ""));
}

export function parseDiagnosticLine(
  line: string,
  workspaceRoot: string | null,
  idPrefix: string,
  index: number,
): Problem | null {
  const text = line.trimEnd();
  if (!text) return null;

  let match = text.match(GCC_LINE) ?? text.match(MSVC_LINE);
  if (!match) return null;

  const file = match[1] ?? "";
  const lineNo = Number(match[2]);
  const col = match[3] ? Number(match[3]) : 1;
  const kind = match[4] ?? "";
  const message = (match[5] ?? "").trim();

  if (!looksLikePath(file) || !Number.isFinite(lineNo) || lineNo < 1) {
    return null;
  }

  return {
    id: `${idPrefix}-${index}`,
    severity: severityOf(kind),
    message,
    file,
    absolutePath: resolveProblemPath(file, workspaceRoot),
    line: lineNo,
    column: Math.max(1, col || 1),
    source: "platformio",
  };
}

export function parseDiagnosticsFromLines(
  lines: string[],
  workspaceRoot: string | null,
  idPrefix = "diag",
): Problem[] {
  const problems: Problem[] = [];
  const seen = new Set<string>();

  lines.forEach((line, index) => {
    const problem = parseDiagnosticLine(line, workspaceRoot, idPrefix, index);
    if (!problem) return;
    const key = `${problem.absolutePath ?? problem.file}:${problem.line}:${problem.column}:${problem.severity}:${problem.message}`;
    if (seen.has(key)) return;
    seen.add(key);
    problems.push(problem);
  });

  return problems;
}
