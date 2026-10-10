import { useEffect } from "react";
import { isTauriRuntime } from "@/lib/tauri";
import { listenFsChanged, watchStop, watchSync } from "@/lib/watcher";
import { useWorkspaceStore } from "@/stores/workspaceStore";

/** Watches all workspace roots and refreshes the matching tree. */
export function useWorkspaceWatcher(): void {
  const kind = useWorkspaceStore((s) => s.kind);
  const folderKey = useWorkspaceStore((s) =>
    s.folders.map((f) => f.path).join("\0"),
  );
  const refreshTree = useWorkspaceStore((s) => s.refreshTree);
  const reloadExternalFiles = useWorkspaceStore((s) => s.reloadExternalFiles);

  useEffect(() => {
    if (!isTauriRuntime() || kind !== "folder" || !folderKey) {
      void watchStop();
      return;
    }

    const roots = folderKey.split("\0").filter(Boolean);
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void (async () => {
      try {
        await watchSync(roots);
        if (disposed) {
          await watchStop();
          return;
        }
        unlisten = await listenFsChanged((payload) => {
          if (disposed) return;
          if (!roots.some((r) => r === payload.root)) return;
          void refreshTree(payload.root);
          void reloadExternalFiles(payload.paths);
        });
      } catch {
        // Watcher is best-effort.
      }
    })();

    return () => {
      disposed = true;
      unlisten?.();
      void watchStop();
    };
  }, [kind, folderKey, refreshTree, reloadExternalFiles]);
}
