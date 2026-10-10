import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { runCommandById } from "@/lib/commands";
import { isTauriRuntime } from "@/lib/tauri";

/** Maps native app menu selections to the shared command registry. */
export function useMenuBridge(): void {
  useEffect(() => {
    if (!isTauriRuntime()) return;

    let unlisten: (() => void) | undefined;
    void listen<string>("menu-command", (event) => {
      const id = event.payload;
      if (typeof id === "string" && id.length > 0) {
        runCommandById(id);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => unlisten?.();
  }, []);
}
