import { useEffect } from "react";
import { isTauriRuntime } from "@/lib/tauri";
import { listenSerialData, listenSerialStatus } from "@/lib/serial";
import { usePlotterStore } from "@/stores/plotterStore";
import { useSerialStore } from "@/stores/serialStore";

/** Subscribes to native serial events for the lifetime of the IDE shell. */
export function useSerialBridge(): void {
  const appendLine = useSerialStore((s) => s.appendLine);
  const applyStatus = useSerialStore((s) => s.applyStatus);
  const hydrateStatus = useSerialStore((s) => s.hydrateStatus);
  const refreshPorts = useSerialStore((s) => s.refreshPorts);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    void hydrateStatus();
    void refreshPorts();

    let disposed = false;
    let unlistenData: (() => void) | undefined;
    let unlistenStatus: (() => void) | undefined;

    void (async () => {
      unlistenData = await listenSerialData((line) => {
        if (disposed) return;
        appendLine(line);
        usePlotterStore.getState().ingestLine(line);
      });
      unlistenStatus = await listenSerialStatus((status) => {
        if (!disposed) applyStatus(status);
      });
    })();

    return () => {
      disposed = true;
      unlistenData?.();
      unlistenStatus?.();
    };
  }, [appendLine, applyStatus, hydrateStatus, refreshPorts]);
}
