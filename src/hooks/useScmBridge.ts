import { useEffect } from "react";
import { isTauriRuntime } from "@/lib/tauri";
import { useScmStore } from "@/stores/scmStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

/** Keeps Git status in sync with the active workspace root. */
export function useScmBridge(): void {
  const kind = useWorkspaceStore((s) => s.kind);
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const refresh = useScmStore((s) => s.refresh);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    void refresh();
  }, [kind, rootPath, refresh]);
}
