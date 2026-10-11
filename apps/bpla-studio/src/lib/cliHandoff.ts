import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/lib/tauri";
import { useInavStore } from "@/stores/inavStore";
import { useSerialStore } from "@/stores/serialStore";

/** Parse `--port COMx --baud 115200` from argv (Aether handoff). */
export function parsePortBaudArgs(args: string[]): {
  port?: string;
  baud?: number;
} {
  let port: string | undefined;
  let baud: number | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if ((a === "--port" || a === "-p") && args[i + 1]) {
      port = args[++i];
    } else if ((a === "--baud" || a === "-b") && args[i + 1]) {
      const n = Number(args[++i]);
      if (Number.isFinite(n) && n > 0) baud = n;
    } else if (a?.startsWith("--port=")) {
      port = a.slice("--port=".length);
    } else if (a?.startsWith("--baud=")) {
      const n = Number(a.slice("--baud=".length));
      if (Number.isFinite(n) && n > 0) baud = n;
    }
  }
  return { port, baud };
}

/** Apply CLI handoff from Aether and connect when a port is provided. */
export async function applyAetherHandoff(): Promise<void> {
  if (!isTauriRuntime()) return;
  let args: string[] = [];
  try {
    args = await invoke<string[]>("get_cli_args");
  } catch {
    return;
  }
  const { port, baud } = parsePortBaudArgs(args);
  if (!port) return;
  const serial = useSerialStore.getState();
  serial.setSelectedPath(port);
  if (baud) serial.setBaudRate(baud);
  await serial.refreshPorts();
  // Ensure path still selected after refresh
  useSerialStore.getState().setSelectedPath(port);
  await useInavStore.getState().connectSession();
}
