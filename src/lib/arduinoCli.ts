import { invoke } from "@tauri-apps/api/core";
import type { PioLibEntry } from "@/lib/platformio";
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

export const ARDUINO_CLI_DOCS_URL =
  "https://arduino.github.io/arduino-cli/latest/installation/";
