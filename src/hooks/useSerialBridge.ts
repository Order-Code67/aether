import { useEffect } from "react";
import { suggestCameraUrlFromSerialLine } from "@/lib/cameraIp";
import { isTauriRuntime } from "@/lib/tauri";
import { ingestMspBytes } from "@/lib/mspIngest";
import {
  listenSerialBytes,
  listenSerialData,
  listenSerialStatus,
} from "@/lib/serial";
import { useCameraStore } from "@/stores/cameraStore";
import { useInavStore } from "@/stores/inavStore";
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
        usePlotterStore.getState().ingestLine(line);
        const suggested = suggestCameraUrlFromSerialLine(line);
        if (suggested) {
          useCameraStore.getState().applySuggestedUrl(suggested);
        }
      });
      unlistenBytes = await listenSerialBytes((bytes) => {
        if (disposed) return;
        ingestMspBytes(bytes);
        usePlotterStore.getState().ingestBytes(bytes);
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
