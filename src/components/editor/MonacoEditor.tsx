import { useEffect, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditorNs } from "monaco-editor";
import { registerExtensionSnippetProviders } from "@/lib/extensionSnippets";
import { AETHER_THEME, defineAetherTheme } from "@/lib/monaco";
import { registerLspMonacoProviders } from "@/lib/lspMonaco";
import { useDebugStore } from "@/stores/debugStore";
import { useEditorStore } from "@/stores/editorStore";
import { useExtensionStore } from "@/stores/extensionStore";
import { useProblemsStore } from "@/stores/problemsStore";
import { useSettingsStore } from "@/stores/settingsStore";

const MARKER_OWNER = "aether-problems";

/** Matches monaco.MarkerSeverity without importing the enum type. */
function severityToMarker(severity: "error" | "warning" | "info"): number {
  if (severity === "error") return 8;
  if (severity === "warning") return 4;
  return 2;
}

function pathMatches(tabPath: string, tabName: string, problemPath: string): boolean {
  if (problemPath === tabPath) return true;
  const normalized = problemPath.replace(/^\.[/\\]/, "").replace(/\//g, "\\");
  const tabNorm = tabPath.replace(/\//g, "\\");
  return (
    tabNorm.endsWith(normalized) ||
    tabNorm.toLowerCase().endsWith(normalized.toLowerCase()) ||
    problemPath.endsWith(tabName)
  );
}

export function MonacoEditor() {
  const activeTab = useEditorStore((s) => {
    const id = s.activeTabId;
    return s.tabs.find((tab) => tab.id === id) ?? null;
  });
  const updateContent = useEditorStore((s) => s.updateContent);
  const setCursor = useEditorStore((s) => s.setCursor);
  const revealRequest = useEditorStore((s) => s.revealRequest);
  const findRequest = useEditorStore((s) => s.findRequest);
  const problems = useProblemsStore((s) => s.problems);
  const breakpoints = useDebugStore((s) => s.breakpoints);
  const stoppedFile = useDebugStore((s) => s.stoppedFile);
  const stoppedLine = useDebugStore((s) => s.stoppedLine);
  const toggleBreakpoint = useDebugStore((s) => s.toggleBreakpoint);
  const extensionEnabledKey = useExtensionStore((s) =>
    s.enabledIds.slice().sort().join(","),
  );

  const fontSize = useSettingsStore((s) => s.fontSize);
  const tabSize = useSettingsStore((s) => s.tabSize);
  const minimap = useSettingsStore((s) => s.minimap);
  const wordWrap = useSettingsStore((s) => s.wordWrap);
  const fontLigatures = useSettingsStore((s) => s.fontLigatures);
  const lineNumbers = useSettingsStore((s) => s.lineNumbers);
  const renderWhitespace = useSettingsStore((s) => s.renderWhitespace);

  const editorRef = useRef<MonacoEditorNs.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const lastRevealToken = useRef(0);
  const lastFindToken = useRef(0);
  const bpDecorations = useRef<string[]>([]);

  useEffect(() => {
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    const tab = activeTab;
    if (!monaco || !editor || !tab) return;

    const model = editor.getModel();
    if (!model) return;

    const forFile = problems.filter((p) =>
      pathMatches(tab.path, tab.name, p.absolutePath ?? p.file),
    );

    monaco.editor.setModelMarkers(
      model,
      MARKER_OWNER,
      forFile.map((p) => ({
        severity: severityToMarker(p.severity),
        message: p.message,
        startLineNumber: p.line,
        startColumn: p.column,
        endLineNumber: p.line,
        endColumn: p.column + 1,
        source: p.source,
      })),
    );
  }, [problems, activeTab]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !revealRequest || !activeTab) return;
    if (revealRequest.token === lastRevealToken.current) return;
    if (
      revealRequest.path !== activeTab.path &&
      !pathMatches(activeTab.path, activeTab.name, revealRequest.path)
    ) {
      return;
    }

    lastRevealToken.current = revealRequest.token;
    const pos = {
      lineNumber: revealRequest.lineNumber,
      column: revealRequest.column,
    };
    editor.revealPositionInCenter(pos);
    editor.setPosition(pos);
    editor.focus();
  }, [revealRequest, activeTab]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !findRequest) return;
    if (findRequest.token === lastFindToken.current) return;
    lastFindToken.current = findRequest.token;
    editor.focus();
    const actionId =
      findRequest.action === "replace"
        ? "editor.action.startFindReplaceAction"
        : "actions.find";
    void editor.getAction(actionId)?.run();
  }, [findRequest]);

  // Re-focus when switching tabs so WebView2 delivers keys to Monaco.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !activeTab) return;
    const timer = window.setTimeout(() => {
      try {
        editor.focus();
      } catch {
        // ignore
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeTab?.id]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.updateOptions({
      fontSize,
      tabSize,
      minimap: { enabled: minimap, scale: 1 },
      wordWrap,
      fontLigatures,
      lineNumbers: lineNumbers ? "on" : "off",
      renderWhitespace,
      glyphMargin: true,
    });
  }, [
    fontSize,
    tabSize,
    minimap,
    wordWrap,
    fontLigatures,
    lineNumbers,
    renderWhitespace,
  ]);

  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) return;
    registerExtensionSnippetProviders(monaco);
  }, [extensionEnabledKey]);

  useEffect(() => {
    const editor = editorRef.current;
    const tab = activeTab;
    if (!editor || !tab) return;

    const forFile = breakpoints.filter((b) =>
      pathMatches(tab.path, tab.name, b.path),
    );
    const showStop =
      stoppedFile &&
      stoppedLine != null &&
      pathMatches(tab.path, tab.name, stoppedFile);

    const decorations: MonacoEditorNs.IModelDeltaDecoration[] = [
      ...forFile.map((b) => ({
        range: {
          startLineNumber: b.line,
          startColumn: 1,
          endLineNumber: b.line,
          endColumn: 1,
        },
        options: {
          isWholeLine: false,
          glyphMarginClassName: "aether-breakpoint-glyph",
          glyphMarginHoverMessage: { value: "Breakpoint" },
        },
      })),
    ];

    if (showStop && stoppedLine != null) {
      decorations.push({
        range: {
          startLineNumber: stoppedLine,
          startColumn: 1,
          endLineNumber: stoppedLine,
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          className: "aether-debug-line",
          overviewRuler: {
            color: "#3d9eff",
            position: 1,
          },
        },
      });
    }

    bpDecorations.current = editor.deltaDecorations(
      bpDecorations.current,
      decorations,
    );
  }, [breakpoints, stoppedFile, stoppedLine, activeTab]);

  if (!activeTab) {
    return null;
  }

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    defineAetherTheme(monaco);
    monaco.editor.setTheme(AETHER_THEME);
    registerLspMonacoProviders(monaco);
    registerExtensionSnippetProviders(monaco);
    // Ensure the editor can accept keystrokes after mount (WebView2 focus quirks).
    window.setTimeout(() => editor.focus(), 0);

    editor.onDidChangeCursorPosition((event) => {
      setCursor({
        lineNumber: event.position.lineNumber,
        column: event.position.column,
      });
    });

    editor.onMouseDown((e) => {
      // Glyph margin = 2 in monaco MouseTargetType
      if (e.target.type !== 2) return;
      const line = e.target.position?.lineNumber;
      const path = useEditorStore.getState().tabs.find(
        (t) => t.id === useEditorStore.getState().activeTabId,
      )?.path;
      if (!line || !path) return;
      toggleBreakpoint(path, line);
    });
  };

  return (
    <div
      className="min-h-0 flex-1"
      onMouseDown={() => {
        // Ensure click into the editor recovers focus from xterm / chrome.
        window.setTimeout(() => editorRef.current?.focus(), 0);
      }}
    >
      <Editor
        key={activeTab.id}
        height="100%"
        theme={AETHER_THEME}
        language={activeTab.language}
        value={activeTab.content}
        path={activeTab.path}
        onMount={handleMount}
        onChange={(value) => {
          updateContent(activeTab.id, value ?? "");
        }}
        options={{
          fontSize,
          fontFamily:
            '"Cascadia Code", "JetBrains Mono", "Fira Code", Consolas, monospace',
          fontLigatures,
          minimap: { enabled: minimap, scale: 1 },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize,
          wordWrap,
          lineNumbers: lineNumbers ? "on" : "off",
          renderWhitespace,
          find: {
            addExtraSpaceOnTop: false,
            autoFindInSelection: "never",
            seedSearchStringFromSelection: "always",
          },
          renderLineHighlight: "line",
          glyphMargin: true,
          cursorBlinking: "smooth",
          smoothScrolling: true,
          padding: { top: 8 },
          bracketPairColorization: { enabled: true },
          readOnly: false,
          domReadOnly: false,
        }}
        loading={
          <div className="flex h-full items-center justify-center text-xs text-aether-fg-muted">
            Loading editor…
          </div>
        }
      />
    </div>
  );
}
