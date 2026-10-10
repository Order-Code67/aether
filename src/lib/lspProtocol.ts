/** Helpers for clangd / LSP JSON-RPC payloads used by the frontend bridge. */

export function uriToPath(uri: string): string {
  let s = uri;
  if (s.startsWith("file:///")) {
    s = s.slice("file:///".length);
  } else if (s.startsWith("file://")) {
    s = s.slice("file://".length);
  }
  try {
    s = decodeURIComponent(s);
  } catch {
    /* keep raw */
  }
  if (/^[A-Za-z]:/.test(s)) {
    return s.replace(/\//g, "\\");
  }
  return s;
}

export function lspRangeToMonaco(range: {
  start: { line: number; character: number };
  end: { line: number; character: number };
}): {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
} {
  return {
    startLineNumber: range.start.line + 1,
    startColumn: range.start.character + 1,
    endLineNumber: range.end.line + 1,
    endColumn: range.end.character + 1,
  };
}

export function monacoPosToLsp(lineNumber: number, column: number): {
  line: number;
  character: number;
} {
  return { line: lineNumber - 1, character: column - 1 };
}

export type LspDiagnosticSeverity = 1 | 2 | 3 | 4;

export interface LspDiagnostic {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  severity?: LspDiagnosticSeverity;
  message: string;
  source?: string;
}

export interface LspPublishDiagnostics {
  uri: string;
  diagnostics: LspDiagnostic[];
}

export function diagnosticSeverity(
  severity: LspDiagnosticSeverity | undefined,
): "error" | "warning" | "info" {
  if (severity === 1) return "error";
  if (severity === 2) return "warning";
  return "info";
}

/** MarkerSeverity: Error=8, Warning=4, Info=2, Hint=1 */
export function toMarkerSeverity(
  severity: LspDiagnosticSeverity | undefined,
): number {
  if (severity === 1) return 8;
  if (severity === 2) return 4;
  if (severity === 3) return 2;
  return 1;
}

export interface LspCompletionItem {
  label: string | { label: string; detail?: string; description?: string };
  kind?: number;
  detail?: string;
  documentation?: string | { value: string };
  insertText?: string;
  textEdit?: {
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    newText: string;
  };
  sortText?: string;
  filterText?: string;
}

export type LspCompletionResult =
  | LspCompletionItem[]
  | { items: LspCompletionItem[]; isIncomplete?: boolean }
  | null;

export interface LspLocation {
  uri: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

export interface LspHover {
  contents:
    | string
    | { language?: string; value: string }
    | Array<string | { language?: string; value: string }>;
  range?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

export function hoverToMarkdown(contents: LspHover["contents"]): string {
  if (typeof contents === "string") return contents;
  if (Array.isArray(contents)) {
    return contents
      .map((c) => {
        if (typeof c === "string") return c;
        if (c.language) return `\`\`\`${c.language}\n${c.value}\n\`\`\``;
        return c.value;
      })
      .join("\n\n");
  }
  if (contents.language) {
    return `\`\`\`${contents.language}\n${contents.value}\n\`\`\``;
  }
  return contents.value;
}

/** Monaco CompletionItemKind mapping from LSP CompletionItemKind. */
export function completionKindToMonaco(kind: number | undefined): number {
  // monaco.languages.CompletionItemKind values
  switch (kind) {
    case 1:
      return 17; // Text
    case 2:
      return 0; // Method
    case 3:
      return 1; // Function
    case 4:
      return 2; // Constructor
    case 5:
      return 3; // Field
    case 6:
      return 4; // Variable
    case 7:
      return 5; // Class
    case 8:
      return 6; // Interface
    case 9:
      return 7; // Module
    case 10:
      return 8; // Property
    case 11:
      return 9; // Unit
    case 12:
      return 10; // Value
    case 13:
      return 11; // Enum
    case 14:
      return 12; // Keyword
    case 15:
      return 13; // Snippet
    case 16:
      return 14; // Color
    case 17:
      return 15; // File
    case 18:
      return 16; // Reference
    case 19:
      return 18; // Folder
    case 20:
      return 19; // EnumMember
    case 21:
      return 20; // Constant
    case 22:
      return 21; // Struct
    case 23:
      return 22; // Event
    case 24:
      return 23; // Operator
    case 25:
      return 24; // TypeParameter
    default:
      return 17; // Text
  }
}
