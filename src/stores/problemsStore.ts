import { create } from "zustand";
import {
  parseDiagnosticLine,
  resolveProblemPath,
} from "@/lib/diagnostics";
import { useEditorStore } from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Problem } from "@/types/problems";

interface ProblemsState {
  problems: Problem[];
  seq: number;
  clear: () => void;
  clearClangd: () => void;
  setClangdProblems: (filePath: string, problems: Problem[]) => void;
  ingestLine: (line: string) => void;
  ingestLines: (lines: string[]) => void;
  setFromBuild: (lines: string[]) => void;
  openProblem: (problem: Problem) => Promise<void>;
  errorCount: () => number;
  warningCount: () => number;
}

function sameFile(a: string, b: string): boolean {
  return a.replace(/\//g, "\\").toLowerCase() === b.replace(/\//g, "\\").toLowerCase();
}

export const useProblemsStore = create<ProblemsState>((set, get) => ({
  problems: [],
  seq: 0,

  clear: () =>
    set((state) => ({
      problems: state.problems.filter((p) => p.source === "clangd"),
    })),

  clearClangd: () =>
    set((state) => ({
      problems: state.problems.filter((p) => p.source !== "clangd"),
    })),

  setClangdProblems: (filePath, next) =>
    set((state) => {
      const kept = state.problems.filter(
        (p) =>
          p.source !== "clangd" ||
          !sameFile(p.absolutePath ?? p.file, filePath),
      );
      return { problems: [...kept, ...next] };
    }),

  ingestLine: (line) => {
    const root = useWorkspaceStore.getState().rootPath;
    const seq = get().seq + 1;
    const problem = parseDiagnosticLine(line, root, "live", seq);
    if (!problem) {
      set({ seq });
      return;
    }
    set((state) => ({
      seq,
      problems: [...state.problems, problem],
    }));
  },

  ingestLines: (lines) => {
    for (const line of lines) {
      get().ingestLine(line);
    }
  },

  setFromBuild: (lines) => {
    const root = useWorkspaceStore.getState().rootPath;
    const problems: Problem[] = [];
    let seq = get().seq;
    const seen = new Set<string>();

    for (const line of lines) {
      seq += 1;
      const problem = parseDiagnosticLine(line, root, "build", seq);
      if (!problem) continue;
      const key = `${problem.absolutePath ?? problem.file}:${problem.line}:${problem.column}:${problem.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      problems.push(problem);
    }

    set({ seq, problems });
  },

  openProblem: async (problem) => {
    const root = useWorkspaceStore.getState().rootPath;
    const path =
      problem.absolutePath ??
      resolveProblemPath(problem.file, root) ??
      problem.file;

    await useWorkspaceStore.getState().openPathInEditor(path);
    useEditorStore.getState().requestReveal({
      path,
      lineNumber: problem.line,
      column: problem.column,
    });
  },

  errorCount: () =>
    get().problems.filter((p) => p.severity === "error").length,

  warningCount: () =>
    get().problems.filter((p) => p.severity === "warning").length,
}));
