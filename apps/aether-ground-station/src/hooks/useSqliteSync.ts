import { useEffect } from "react";
import { dbGetJson, dbUpsertJson } from "@/services/database";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useProfileStore } from "@/stores/profileStore";
import { eventBus } from "@/services/events/eventBus";

/**
 * SQLite as source of truth: hydrate from DB then mirror store changes.
 */
export function useSqliteSync(): void {
  useEffect(() => {
    let unsubWs: (() => void) | undefined;
    let unsubPr: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      const ws = await dbGetJson<{
        layouts: ReturnType<typeof useWorkspaceStore.getState>["layouts"];
        activeLayoutId: string;
      } | null>("workspace_layouts", null);
      const profiles = await dbGetJson<
        ReturnType<typeof useProfileStore.getState>["profiles"] | null
      >("profiles", null);

      if (cancelled) return;

      if (ws?.layouts?.length) {
        useWorkspaceStore.setState({
          layouts: ws.layouts,
          activeLayoutId: ws.activeLayoutId,
        });
      }
      if (profiles?.length) {
        useProfileStore.setState({ profiles });
      }

      eventBus.emit("info", "storage", "Состояние синхронизировано с SQLite");

      unsubWs = useWorkspaceStore.subscribe((s) => {
        void dbUpsertJson("workspace_layouts", {
          layouts: s.layouts,
          activeLayoutId: s.activeLayoutId,
        });
      });
      unsubPr = useProfileStore.subscribe((s) => {
        void dbUpsertJson("profiles", s.profiles);
        void dbUpsertJson("active_profile_id", s.activeProfileId);
      });
    })();

    return () => {
      cancelled = true;
      unsubWs?.();
      unsubPr?.();
    };
  }, []);
}
