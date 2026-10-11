import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/lib/tauri";
import {
  INAV_CONFIGURATOR_DOWNLOAD_URL,
  INAV_DOCS_URL,
  inavConfiguratorCandidatePaths,
  type InavPathEnv,
} from "@/lib/inavConfiguratorPaths";

export type InavConfiguratorInfo = {
  installed: boolean;
  path: string | null;
};

export {
  INAV_CONFIGURATOR_DOWNLOAD_URL,
  INAV_DOCS_URL,
  inavConfiguratorCandidatePaths,
};

/** Build env snapshot for pure path listing (Node / tests). */
export function readInavPathEnv(): InavPathEnv {
  const env =
    typeof globalThis !== "undefined" &&
    "process" in globalThis &&
    (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process?.env
      ? (globalThis as { process: { env: Record<string, string | undefined> } })
          .process.env
      : undefined;
  if (!env) return {};
  const pathVar = env.PATH ?? env.Path ?? "";
  return {
    localAppData: env.LOCALAPPDATA,
    programFiles: env.ProgramFiles,
    programFilesX86: env["ProgramFiles(x86)"],
    home: env.USERPROFILE ?? env.HOME,
    pathEntries: pathVar.split(/;+/).filter(Boolean),
  };
}

export async function detectInavConfigurator(): Promise<InavConfiguratorInfo> {
  if (!isTauriRuntime()) {
    return { installed: false, path: null };
  }
  return invoke<InavConfiguratorInfo>("inav_configurator_detect");
}

export async function openInavConfigurator(): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error("INAV_DESKTOP_REQUIRED");
  }
  await invoke("open_external_inav_configurator");
}
