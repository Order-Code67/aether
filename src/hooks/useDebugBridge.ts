import { useEffect } from "react";
import { isTauriRuntime } from "@/lib/tauri";
import { listenDebugConsole, listenDebugEvent } from "@/lib/debug";
import { useDebugStore } from "@/stores/debugStore";

/** Subscribes to debugger MI events and console output. */
export function useDebugBridge(): void {
  const applyEvent = useDebugStore((s) => s.applyEvent);
  const appendConsole = useDebugStore((s) => s.appendConsole);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let disposed = false;
    let unEvent: (() => void) | undefined;
    let unConsole: (() => void) | undefined;

    void (async () => {
      unEvent = await listenDebugEvent((payload) => {
        if (!disposed) applyEvent(payload);
      });
      unConsole = await listenDebugConsole((payload) => {
        if (!disposed) appendConsole(payload);
      });
    })();

    return () => {
      disposed = true;
      unEvent?.();
      unConsole?.();
    };
  }, [applyEvent, appendConsole]);
}
