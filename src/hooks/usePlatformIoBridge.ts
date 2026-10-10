import { useEffect } from "react";
import { isTauriRuntime } from "@/lib/tauri";
import { listenPioOutput, listenPioStatus } from "@/lib/platformio";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

/** Keeps PlatformIO CLI/project state and output events in sync. */
export function usePlatformIoBridge(): void {
  const refreshCli = usePlatformIoStore((s) => s.refreshCli);
  const refreshProject = usePlatformIoStore((s) => s.refreshProject);
  const appendOutput = usePlatformIoStore((s) => s.appendOutput);
  const applyStatus = usePlatformIoStore((s) => s.applyStatus);

  const kind = useWorkspaceStore((s) => s.kind);
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const folderKey = useWorkspaceStore((s) =>
    s.folders.map((f) => f.path).join("\0"),
  );

  useEffect(() => {
    if (!isTauriRuntime()) return;
    void refreshCli();
  }, [refreshCli]);

  useEffect(() => {
    void refreshProject();
  }, [kind, rootPath, folderKey, refreshProject]);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let disposed = false;
    let unlistenOut: (() => void) | undefined;
    let unlistenStatus: (() => void) | undefined;

    void (async () => {
      unlistenOut = await listenPioOutput((payload) => {
        if (!disposed) appendOutput(payload);
      });
      unlistenStatus = await listenPioStatus((payload) => {
        if (!disposed) applyStatus(payload);
      });
    })();

    return () => {
      disposed = true;
      unlistenOut?.();
      unlistenStatus?.();
    };
  }, [appendOutput, applyStatus]);
}
