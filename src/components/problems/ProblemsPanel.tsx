import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/cn";
import { basename } from "@/lib/paths";
import { useProblemsStore } from "@/stores/problemsStore";
import type { Problem, ProblemSeverity } from "@/types/problems";

function SeverityIcon({ severity }: { severity: ProblemSeverity }) {
  if (severity === "error") {
    return <AlertCircle size={13} className="shrink-0 text-aether-danger" />;
  }
  if (severity === "warning") {
    return <AlertTriangle size={13} className="shrink-0 text-aether-warning" />;
  }
  return <Info size={13} className="shrink-0 text-aether-accent" />;
}

function ProblemRow({ problem }: { problem: Problem }) {
  const openProblem = useProblemsStore((s) => s.openProblem);
  const label = basename(problem.absolutePath ?? problem.file);

  return (
    <button
      type="button"
      onClick={() => {
        void openProblem(problem);
      }}
      className="flex w-full items-start gap-2 px-3 py-1 text-left text-[12px] hover:bg-aether-surface-raised"
    >
      <SeverityIcon severity={problem.severity} />
      <span className="min-w-0 flex-1">
        <span className="text-aether-fg">{problem.message}</span>
        <span className="mt-0.5 block truncate text-[11px] text-aether-fg-dim">
          {label}:{problem.line}:{problem.column}
        </span>
      </span>
    </button>
  );
}

export function ProblemsPanel() {
  const problems = useProblemsStore((s) => s.problems);
  const errors = problems.filter((p) => p.severity === "error").length;
  const warnings = problems.filter((p) => p.severity === "warning").length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-7 shrink-0 items-center gap-3 border-b border-aether-border px-3 text-[11px] text-aether-fg-muted">
        <span
          className={cn(errors > 0 ? "text-aether-danger" : undefined)}
        >
          {errors} error{errors === 1 ? "" : "s"}
        </span>
        <span
          className={cn(warnings > 0 ? "text-aether-warning" : undefined)}
        >
          {warnings} warning{warnings === 1 ? "" : "s"}
        </span>
      </div>

      <div className="aether-scroll min-h-0 flex-1 overflow-auto py-1">
        {problems.length === 0 ? (
          <p className="px-3 py-2 font-mono text-xs text-aether-fg-muted">
            No problems detected in the workspace.
          </p>
        ) : (
          problems.map((problem) => (
            <ProblemRow key={problem.id} problem={problem} />
          ))
        )}
      </div>
    </div>
  );
}
