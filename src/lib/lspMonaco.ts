import type { Monaco } from "@monaco-editor/react";
import type { editor, languages, Position } from "monaco-editor";
import { lspPathToUri, lspRequest } from "@/lib/lsp";
import {
  completionKindToMonaco,
  hoverToMarkdown,
  lspRangeToMonaco,
  monacoPosToLsp,
  type LspCompletionItem,
  type LspCompletionResult,
  type LspHover,
  type LspLocation,
  uriToPath,
} from "@/lib/lspProtocol";
import { useEditorStore } from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

let registered = false;
let getRunning: () => boolean = () => false;

export function setLspMonacoRunning(fn: () => boolean): void {
  getRunning = fn;
}

function modelPath(model: editor.ITextModel): string {
  const uri = model.uri;
  if (uri.scheme === "file") {
    return uriToPath(uri.toString());
  }
  // @monaco-editor/react often uses path as in-memory URI path
  const p = uri.path.replace(/^\//, "");
  if (/^[A-Za-z]:/.test(p)) {
    return p.replace(/\//g, "\\");
  }
  // Decode /d:/foo style
  const m = p.match(/^([A-Za-z]):\/(.*)$/);
  if (m) {
    return `${m[1]}:\\${m[2]!.replace(/\//g, "\\")}`;
  }
  return p.replace(/\//g, "\\");
}

function labelOf(item: LspCompletionItem): string {
  return typeof item.label === "string" ? item.label : item.label.label;
}

function docOf(item: LspCompletionItem): string | undefined {
  if (!item.documentation) return undefined;
  return typeof item.documentation === "string"
    ? item.documentation
    : item.documentation.value;
}

function normalizeLocations(result: unknown): LspLocation[] {
  if (!result) return [];
  if (Array.isArray(result)) {
    return result
      .map((item) => {
        if (item && typeof item === "object" && "targetUri" in item) {
          const link = item as {
            targetUri: string;
            targetSelectionRange?: LspLocation["range"];
            targetRange: LspLocation["range"];
          };
          return {
            uri: link.targetUri,
            range: link.targetSelectionRange ?? link.targetRange,
          };
        }
        return item as LspLocation;
      })
      .filter((l) => l?.uri && l?.range);
  }
  if (typeof result === "object" && result !== null && "uri" in result) {
    return [result as LspLocation];
  }
  return [];
}

async function openLocation(loc: LspLocation): Promise<void> {
  const path = uriToPath(loc.uri);
  await useWorkspaceStore.getState().openPathInEditor(path);
  const range = lspRangeToMonaco(loc.range);
  useEditorStore.getState().requestReveal({
    path,
    lineNumber: range.startLineNumber,
    column: range.startColumn,
  });
}

export function registerLspMonacoProviders(monaco: Monaco): void {
  if (registered) return;
  registered = true;

  for (const language of ["cpp", "c"] as const) {
    monaco.languages.registerCompletionItemProvider(language, {
      triggerCharacters: [".", ":", ">", "<", '"', "/", "*"],
      provideCompletionItems: async (
        model: editor.ITextModel,
        position: Position,
      ) => {
        if (!getRunning()) return { suggestions: [] };
        try {
          const docUri = await lspPathToUri(modelPath(model));
          const result = await lspRequest<LspCompletionResult>(
            "textDocument/completion",
            {
              textDocument: { uri: docUri },
              position: monacoPosToLsp(position.lineNumber, position.column),
            },
          );

          const items: LspCompletionItem[] = Array.isArray(result)
            ? result
            : (result?.items ?? []);

          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          const suggestions: languages.CompletionItem[] = items.map(
            (item, index) => {
              const insert =
                item.textEdit?.newText ?? item.insertText ?? labelOf(item);
              const itemRange = item.textEdit
                ? lspRangeToMonaco(item.textEdit.range)
                : range;
              return {
                label: labelOf(item),
                kind: completionKindToMonaco(
                  item.kind,
                ) as languages.CompletionItemKind,
                detail: item.detail,
                documentation: docOf(item),
                insertText: insert,
                range: itemRange,
                sortText: item.sortText ?? String(index).padStart(5, "0"),
                filterText: item.filterText ?? labelOf(item),
              };
            },
          );

          return { suggestions };
        } catch {
          return { suggestions: [] };
        }
      },
    });

    monaco.languages.registerHoverProvider(language, {
      provideHover: async (model: editor.ITextModel, position: Position) => {
        if (!getRunning()) return null;
        try {
          const docUri = await lspPathToUri(modelPath(model));
          const result = await lspRequest<LspHover | null>(
            "textDocument/hover",
            {
              textDocument: { uri: docUri },
              position: monacoPosToLsp(position.lineNumber, position.column),
            },
          );
          if (!result?.contents) return null;
          const md = hoverToMarkdown(result.contents);
          if (!md.trim()) return null;
          return {
            contents: [{ value: md }],
            range: result.range ? lspRangeToMonaco(result.range) : undefined,
          };
        } catch {
          return null;
        }
      },
    });

    monaco.languages.registerDefinitionProvider(language, {
      provideDefinition: async (
        model: editor.ITextModel,
        position: Position,
      ) => {
        if (!getRunning()) return [];
        try {
          const docUri = await lspPathToUri(modelPath(model));
          const result = await lspRequest("textDocument/definition", {
            textDocument: { uri: docUri },
            position: monacoPosToLsp(position.lineNumber, position.column),
          });
          const locs = normalizeLocations(result);
          if (locs.length === 0) return [];
          if (locs.length === 1) {
            await openLocation(locs[0]!);
            return [];
          }
          return locs.map((loc) => ({
            uri: monaco.Uri.file(uriToPath(loc.uri)),
            range: lspRangeToMonaco(loc.range),
          }));
        } catch {
          return [];
        }
      },
    });
  }
}
