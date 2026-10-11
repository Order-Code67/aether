/**
 * Frontend bridge for dfu-util detect / list / flash.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { isTauriRuntime } from "@/lib/tauri";
import { usePlatformIoStore } from "@/stores/platformioStore";

export interface DfuUtilInfo {
  installed: boolean;
  path: string | null;
  version: string | null;
}

export interface DfuListResult {
  toolInstalled: boolean;
  devices: string[];
  raw: string;
  error: string | null;
}

export interface DfuStatusPayload {
  running: boolean;
  success: boolean | null;
  code: number | null;
  error: string | null;
}

export async function detectDfuUtil(): Promise<DfuUtilInfo> {
  if (!isTauriRuntime()) {
    return { installed: false, path: null, version: null };
  }
  return invoke<DfuUtilInfo>("dfu_util_detect");
}

export async function listDfuDevices(): Promise<DfuListResult> {
  if (!isTauriRuntime()) {
    return {
      toolInstalled: false,
      devices: [],
      raw: "",
      error: "DFU_DESKTOP_REQUIRED",
    };
  }
  return invoke<DfuListResult>("dfu_list_devices");
}

export async function pickHexFile(locale: "en" | "ru"): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const chosen = await open({
    title: locale === "ru" ? "Выбрать прошивку .hex" : "Select firmware .hex",
    multiple: false,
    filters: [
      { name: "Intel HEX", extensions: ["hex"] },
      { name: "Binary", extensions: ["bin"] },
      { name: "All", extensions: ["*"] },
    ],
  });
  return typeof chosen === "string" ? chosen : null;
}

export async function flashHex(hexPath: string): Promise<void> {
  return invoke("dfu_flash_hex", { hexPath });
}

/** Stream DFU log lines into the Output panel. */
export async function listenDfuBridge(
  onStatus: (status: DfuStatusPayload) => void,
): Promise<() => void> {
  if (!isTauriRuntime()) return () => {};

  const unsubs: UnlistenFn[] = [];
  unsubs.push(
    await listen<{ stream: string; line: string }>("dfu-output", (ev) => {
      usePlatformIoStore.getState().appendOutput({
        stream: (ev.payload.stream === "stderr"
          ? "stderr"
          : ev.payload.stream === "system"
            ? "system"
            : "stdout") as "stdout" | "stderr" | "system",
        line: ev.payload.line,
      });
    }),
  );
  unsubs.push(
    await listen<DfuStatusPayload>("dfu-status", (ev) => {
      onStatus(ev.payload);
      if (!ev.payload.running) {
        usePlatformIoStore.getState().appendOutput({
          stream: "system",
          line: ev.payload.success
            ? "DFU flash finished successfully."
            : `DFU flash ended${ev.payload.error ? `: ${ev.payload.error}` : "."}`,
        });
      }
    }),
  );

  return () => {
    for (const u of unsubs) u();
  };
}
