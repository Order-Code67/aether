export type ProblemSeverity = "error" | "warning" | "info";

export interface Problem {
  id: string;
  severity: ProblemSeverity;
  message: string;
  /** Absolute or workspace-relative path as reported by the tool */
  file: string;
  /** Resolved absolute path when possible */
  absolutePath: string | null;
  line: number;
  column: number;
  source: string;
}
