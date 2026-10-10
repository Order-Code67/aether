export type EditorLanguage =
  | "cpp"
  | "c"
  | "plaintext"
  | "json"
  | "ini"
  | "markdown"
  | "python"
  | "typescript"
  | "javascript";

export interface EditorTab {
  id: string;
  path: string;
  name: string;
  language: EditorLanguage;
  content: string;
  dirty: boolean;
}

export interface CursorPosition {
  lineNumber: number;
  column: number;
}

export function languageFromPath(path: string): EditorLanguage {
  const ext = path.includes(".")
    ? path.slice(path.lastIndexOf(".") + 1).toLowerCase()
    : "";

  switch (ext) {
    case "ino":
    case "cpp":
    case "cc":
    case "cxx":
    case "hpp":
    case "h":
      return "cpp";
    case "c":
      return "c";
    case "json":
      return "json";
    case "ini":
    case "cfg":
    case "conf":
      return "ini";
    case "md":
      return "markdown";
    case "py":
      return "python";
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
      return "javascript";
    default:
      return "plaintext";
  }
}

export function languageLabel(language: EditorLanguage): string {
  switch (language) {
    case "cpp":
      return "C++";
    case "c":
      return "C";
    case "json":
      return "JSON";
    case "ini":
      return "INI";
    case "markdown":
      return "Markdown";
    case "python":
      return "Python";
    case "typescript":
      return "TypeScript";
    case "javascript":
      return "JavaScript";
    default:
      return "Plain Text";
  }
}

export function tabNameFromPath(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}
