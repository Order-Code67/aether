import { useEffect } from "react";
import { ingestMspBytes } from "@/lib/mspIngest";
import {
  listenSerialBytes,
  listenSerialData,
  listenSerialStatus,
} from "@/lib/serial";
import { isTauriRuntime } from "@/lib/tauri";
import { useInavStore } from "@/stores/inavStore";
import { useSerialStore } from "@/stores/serialStore";

/** Serial event bridge for БПЛА-Студия (CLI + MSP). */
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
    let unlistenBytes: (() => void) | undefined;
    let unlistenStatus: (() => void) | undefined;

    void (async () => {
      unlistenData = await listenSerialData((line) => {
        if (disposed) return;
        appendLine(line);
        const inav = useInavStore.getState();
        if (inav.sessionActive) {
          inav.appendCliLine(line);
          if (inav.capturingDiff) {
            inav.appendDiffCapture(
              line.endsWith("\n") ? line : `${line}\n`,
            );
          }
        }
      });
      unlistenBytes = await listenSerialBytes((bytes) => {
        if (disposed) return;
        ingestMspBytes(bytes);
      });
      unlistenStatus = await listenSerialStatus((status) => {
        if (!disposed) {
          applyStatus(status);
          if (!status.connected) {
            useInavStore.getState().setSessionActive(false);
            useInavStore.getState().setCapturingDiff(false);
          }
        }
      });
    })();

    return () => {
      disposed = true;
      unlistenData?.();
      unlistenBytes?.();
      unlistenStatus?.();
    };
  }, [appendLine, applyStatus, hydrateStatus, refreshPorts]);
}
