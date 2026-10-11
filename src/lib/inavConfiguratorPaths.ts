/**
 * Pure candidate paths for iNav Configurator (Electron) on Windows.
 * Pass env-like values so unit tests do not touch the real filesystem.
 */

export type InavPathEnv = {
  localAppData?: string;
  programFiles?: string;
  programFilesX86?: string;
  home?: string;
  pathEntries?: string[];
};

const EXE_NAMES = [
  "INAV Configurator.exe",
  "inav-configurator.exe",
  "INAV-Configurator.exe",
] as const;

function joinWin(...parts: string[]): string {
  return parts
    .filter((p) => p.length > 0)
    .join("\\")
    .replace(/\\+/g, "\\");
}

/** Ordered install / PATH candidates (may not exist). */
export function inavConfiguratorCandidatePaths(env: InavPathEnv): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (p: string) => {
    const n = p.replace(/\//g, "\\");
    const key = n.toLowerCase();
    if (!n || seen.has(key)) return;
    seen.add(key);
    out.push(n);
  };

  const roots: string[] = [];
  if (env.localAppData) {
    roots.push(
      joinWin(env.localAppData, "Programs", "inav-configurator"),
      joinWin(env.localAppData, "Programs", "INAV Configurator"),
      joinWin(env.localAppData, "inav-configurator"),
      joinWin(env.localAppData, "INAV Configurator"),
    );
  }
  if (env.programFiles) {
    roots.push(
      joinWin(env.programFiles, "INAV Configurator"),
      joinWin(env.programFiles, "inav-configurator"),
    );
  }
  if (env.programFilesX86) {
    roots.push(
      joinWin(env.programFilesX86, "INAV Configurator"),
      joinWin(env.programFilesX86, "inav-configurator"),
    );
  }
  if (env.home) {
    roots.push(
      joinWin(env.home, "AppData", "Local", "Programs", "inav-configurator"),
      joinWin(env.home, "AppData", "Local", "Programs", "INAV Configurator"),
    );
  }

  for (const root of roots) {
    for (const name of EXE_NAMES) {
      push(joinWin(root, name));
    }
  }

  for (const dir of env.pathEntries ?? []) {
    const trimmed = dir.trim();
    if (!trimmed) continue;
    for (const name of EXE_NAMES) {
      push(joinWin(trimmed, name));
    }
  }

  return out;
}

export const INAV_CONFIGURATOR_DOWNLOAD_URL =
  "https://github.com/iNavFlight/inav-configurator/releases";

export const INAV_DOCS_URL = "https://github.com/iNavFlight/inav/wiki";
