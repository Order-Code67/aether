import { invoke } from "@tauri-apps/api/core";
import type { PioLibEntry, PioRunTask } from "@/lib/platformio";
import { isTauriRuntime } from "@/lib/tauri";

export interface ArduinoCliInfo {
  installed: boolean;
  path: string | null;
  version: string | null;
}

export async function detectArduinoCli(): Promise<ArduinoCliInfo> {
  if (!isTauriRuntime()) {
    return { installed: false, path: null, version: null };
  }
  return invoke<ArduinoCliInfo>("arduino_cli_detect");
}

export async function searchArduinoCliLibraries(
  query: string,
): Promise<PioLibEntry[]> {
  if (!isTauriRuntime()) return [];
  return invoke<PioLibEntry[]>("arduino_cli_lib_search", { query });
}

export async function installArduinoCliLibrary(
  cwd: string,
  library: string,
): Promise<string> {
  return invoke<string>("arduino_cli_lib_install", { cwd, library });
}

export async function listArduinoCliLibFolders(
  cwd: string,
): Promise<string[]> {
  if (!isTauriRuntime()) return [];
  return invoke<string[]>("arduino_cli_lib_list", { cwd });
}

/** Compile / upload / clean via arduino-cli (streams to pio-output / pio-status). */
export async function runArduinoCliTask(options: {
  cwd: string;
  task: PioRunTask;
  env?: string | null;
  fqbn?: string | null;
  uploadPort?: string | null;
}): Promise<void> {
  return invoke("arduino_cli_run", {
    cwd: options.cwd,
    task: options.task,
    env: options.env ?? null,
    fqbn: options.fqbn ?? null,
    uploadPort: options.uploadPort ?? null,
  });
}

/** Verify / install arduino:avr + esp32:esp32 cores when missing. */
export async function ensureArduinoCliCores(): Promise<string> {
  if (!isTauriRuntime()) {
    return "arduino-cli cores: desktop only";
  }
  return invoke<string>("arduino_cli_ensure_cores");
}

export const ARDUINO_CLI_DOCS_URL =
  "https://arduino.github.io/arduino-cli/latest/installation/";

/** Official releases page (Windows MSI / zip). */
export const ARDUINO_CLI_RELEASES_URL =
  "https://github.com/arduino/arduino-cli/releases";

export async function openArduinoCliInstallDocs(): Promise<void> {
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(ARDUINO_CLI_DOCS_URL);
  } catch {
    window.open(ARDUINO_CLI_DOCS_URL, "_blank", "noopener,noreferrer");
  }
}
