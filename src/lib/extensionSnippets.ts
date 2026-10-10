import type { Monaco } from "@monaco-editor/react";
import type { editor, languages, Position } from "monaco-editor";
import { useExtensionStore } from "@/stores/extensionStore";

const disposables: { dispose: () => void }[] = [];

/** Register snippet completion providers driven by enabled extensions. */
export function registerExtensionSnippetProviders(monaco: Monaco): void {
  // Re-register when called again after enable/disable — dispose first.
  for (const d of disposables) {
    d.dispose();
  }
  disposables.length = 0;

  const languagesToCover = new Set<string>(["cpp", "c", "ini"]);
  for (const m of useExtensionStore.getState().enabledManifests()) {
    for (const lang of m.contributes?.languages ?? []) {
      languagesToCover.add(lang);
    }
  }

  for (const language of languagesToCover) {
    const disposable = monaco.languages.registerCompletionItemProvider(
      language,
      {
        triggerCharacters: [],
        provideCompletionItems: (
          model: editor.ITextModel,
          position: Position,
        ) => {
          const lang = model.getLanguageId();
          const snippets =
            useExtensionStore.getState().snippetsForLanguage(lang);
          if (snippets.length === 0) {
            return { suggestions: [] };
          }

          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          const suggestions: languages.CompletionItem[] = snippets.map(
            (s) => ({
              label: s.label,
              kind: 27 as languages.CompletionItemKind, // Snippet
              insertText: s.insertText,
              insertTextRules:
                4 as languages.CompletionItemInsertTextRule, // InsertAsSnippet
              detail: s.detail ?? "Extension snippet",
              documentation: s.documentation,
              range,
              sortText: `0_${s.label}`,
            }),
          );

          return { suggestions };
        },
      },
    );
    disposables.push(disposable);
  }
}

/** Call after toggling extensions so providers refresh. */
export function refreshExtensionSnippets(monaco: Monaco | null): void {
  if (!monaco) return;
  registerExtensionSnippetProviders(monaco);
}
