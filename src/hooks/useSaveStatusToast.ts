import { useEffect } from "react";
import { useEditorStore } from "@/stores/editorStore";

/** Clears transient save success/error after a short delay. */
export function useSaveStatusToast(timeoutMs = 2500): void {
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const clearSaveStatus = useEditorStore((s) => s.clearSaveStatus);

  useEffect(() => {
    if (saveStatus.kind !== "saved" && saveStatus.kind !== "error") {
      return;
    }

    const timer = window.setTimeout(() => {
      clearSaveStatus();
    }, timeoutMs);

    return () => window.clearTimeout(timer);
  }, [saveStatus, clearSaveStatus, timeoutMs]);
}
