import { useEffect, useRef } from "react";
import {
  isCppPath,
  listenLspNotification,
  listenLspStatus,
} from "@/lib/lsp";
import {
  lspDidChange,
  lspDidClose,
  lspDidOpen,
  lspDidSave,
  lspInitialize,
  resetLspDocuments,
} from "@/lib/lspClient";
import { setLspMonacoRunning } from "@/lib/lspMonaco";
import {
  diagnosticSeverity,
  type LspPublishDiagnostics,
  uriToPath,
} from "@/lib/lspProtocol";
import { isTauriRuntime } from "@/lib/tauri";
import { useEditorStore } from "@/stores/editorStore";
import { useLspStore } from "@/stores/lspStore";
import { useProblemsStore } from "@/stores/problemsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Problem } from "@/types/problems";

const CHANGE_DEBOUNCE_MS = 280;

/** Starts clangd for the active folder and syncs open C/C++ documents. */
export function useLspBridge(): void {
  const kind = useWorkspaceStore((s) => s.kind);
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const restartToken = useLspStore((s) => s.restartToken);
  const refreshDetect = useLspStore((s) => s.refreshDetect);
  const startForWorkspace = useLspStore((s) => s.startForWorkspace);
  const stop = useLspStore((s) => s.stop);
  const applyStatus = useLspStore((s) => s.applyStatus);
  const setClangdProblems = useProblemsStore((s) => s.setClangdProblems);

  const readyRef = useRef(false);
  const changeTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const openPathsRef = useRef(new Set<string>());

  useEffect(() => {
    setLspMonacoRunning(() => useLspStore.getState().status.running && readyRef.current);
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    void refreshDetect();
  }, [refreshDetect]);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let disposed = false;
    let unlistenNotif: (() => void) | undefined;
    let unlistenStatus: (() => void) | undefined;

    void (async () => {
      unlistenNotif = await listenLspNotification((payload) => {
        if (disposed) return;
        if (payload.method !== "textDocument/publishDiagnostics") return;
        const params = payload.params as LspPublishDiagnostics;
        if (!params?.uri || !Array.isArray(params.diagnostics)) return;

        const filePath = uriToPath(params.uri);
        const problems: Problem[] = params.diagnostics.map((d, i) => ({
          id: `clangd-${filePath}-${i}-${d.range.start.line}`,
          severity: diagnosticSeverity(d.severity),
          message: d.message,
          file: filePath,
          absolutePath: filePath,
          line: d.range.start.line + 1,
          column: d.range.start.character + 1,
          source: "clangd",
        }));
        setClangdProblems(filePath, problems);
      });

      unlistenStatus = await listenLspStatus((status) => {
        if (!disposed) applyStatus(status);
      });
    })();

    return () => {
      disposed = true;
      unlistenNotif?.();
      unlistenStatus?.();
    };
  }, [applyStatus, setClangdProblems]);

  // Start / stop clangd when the active workspace root changes.
  useEffect(() => {
    if (!isTauriRuntime()) return;

    let cancelled = false;
    readyRef.current = false;
    resetLspDocuments();
    openPathsRef.current.clear();
    useProblemsStore.getState().clearClangd();

    void (async () => {
      if (kind !== "folder" || !rootPath) {
        await stop();
        return;
      }

      const started = await startForWorkspace();
      if (cancelled || !started) return;

      try {
        await lspInitialize(rootPath);
        if (cancelled) return;
        readyRef.current = true;

        const tabs = useEditorStore.getState().tabs;
        for (const tab of tabs) {
          if (!isCppPath(tab.path)) continue;
          await lspDidOpen(tab.path, tab.content);
          openPathsRef.current.add(tab.path);
        }
      } catch (error) {
        readyRef.current = false;
        useLspStore.setState({
          error:
            error instanceof Error
              ? error.message
              : "clangd initialize failed.",
        });
      }
    })();

    return () => {
      cancelled = true;
      readyRef.current = false;
      for (const timer of changeTimers.current.values()) {
        clearTimeout(timer);
      }
      changeTimers.current.clear();
    };
  }, [kind, rootPath, restartToken, startForWorkspace, stop]);

  // Sync document open/close/change with the editor store.
  useEffect(() => {
    if (!isTauriRuntime()) return;

    let prevTabs = useEditorStore.getState().tabs;
    let prevSave = useEditorStore.getState().saveStatus;

    const unsub = useEditorStore.subscribe((state) => {
      if (!readyRef.current || !useLspStore.getState().status.running) {
        prevTabs = state.tabs;
        prevSave = state.saveStatus;
        return;
      }

      const nextPaths = new Set(
        state.tabs.filter((t) => isCppPath(t.path)).map((t) => t.path),
      );

      // Closed
      for (const path of openPathsRef.current) {
        if (!nextPaths.has(path)) {
          void lspDidClose(path);
          openPathsRef.current.delete(path);
          useProblemsStore.getState().setClangdProblems(path, []);
        }
      }

      // Opened or content changed
      for (const tab of state.tabs) {
        if (!isCppPath(tab.path)) continue;
        if (!openPathsRef.current.has(tab.path)) {
          void lspDidOpen(tab.path, tab.content);
          openPathsRef.current.add(tab.path);
          continue;
        }
        const prev = prevTabs.find((t) => t.path === tab.path);
        if (prev && prev.content !== tab.content) {
          const existing = changeTimers.current.get(tab.path);
          if (existing) clearTimeout(existing);
          const path = tab.path;
          const content = tab.content;
          changeTimers.current.set(
            path,
            setTimeout(() => {
              changeTimers.current.delete(path);
              if (readyRef.current) void lspDidChange(path, content);
            }, CHANGE_DEBOUNCE_MS),
          );
        }
      }

      if (
        state.saveStatus.kind === "saved" &&
        prevSave.kind !== "saved" &&
        isCppPath(state.saveStatus.path)
      ) {
        void lspDidSave(state.saveStatus.path);
      }

      prevTabs = state.tabs;
      prevSave = state.saveStatus;
    });

    return () => unsub();
  }, []);
}
