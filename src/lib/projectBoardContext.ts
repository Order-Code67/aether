import {
  formatPinMapForPrompt,
  resolveLoraPinMap,
} from "@/lib/hardwarePinMaps";

/** Extract board= and lib_deps lines from platformio.ini text. */
export function parsePlatformioIniSnippet(ini: string): {
  board: string | null;
  libDeps: string[];
  buildFlags: string[];
} {
  const boardMatch = ini.match(/^\s*board\s*=\s*(\S+)/m);
  const libDeps: string[] = [];
  const buildFlags: string[] = [];
  const lines = ini.split(/\r?\n/);
  let inLib = false;
  let inFlags = false;
  for (const line of lines) {
    if (/^\s*lib_deps\s*=/.test(line)) {
      inLib = true;
      inFlags = false;
      const inline = line.replace(/^\s*lib_deps\s*=\s*/, "").trim();
      if (inline) libDeps.push(inline);
      continue;
    }
    if (/^\s*build_flags\s*=/.test(line)) {
      inFlags = true;
      inLib = false;
      const inline = line.replace(/^\s*build_flags\s*=\s*/, "").trim();
      if (inline) buildFlags.push(inline);
      continue;
    }
    if (/^\S/.test(line) && !/^\s*;/.test(line)) {
      inLib = false;
      inFlags = false;
    }
    if (inLib && /^\s+\S/.test(line)) {
      libDeps.push(line.trim());
    }
    if (inFlags && /^\s+\S/.test(line)) {
      buildFlags.push(line.trim());
    }
  }
  return {
    board: boardMatch?.[1] ?? null,
    libDeps,
    buildFlags,
  };
}

export function buildBoardHardwareContext(options: {
  selectedEnv: string;
  iniText?: string | null;
}): string | null {
  const env = options.selectedEnv?.trim();
  if (!env && !options.iniText) return null;

  const parts: string[] = ["Project board / radio context:"];
  if (env) parts.push(`Selected PlatformIO env: ${env}`);

  const parsed = options.iniText
    ? parsePlatformioIniSnippet(options.iniText)
    : null;
  if (parsed?.board) parts.push(`board = ${parsed.board}`);
  if (parsed?.libDeps.length) {
    parts.push(`lib_deps:\n${parsed.libDeps.map((d) => `  - ${d}`).join("\n")}`);
  }
  if (parsed?.buildFlags.length) {
    parts.push(
      `build_flags:\n${parsed.buildFlags.map((d) => `  - ${d}`).join("\n")}`,
    );
  }

  const pinMap = resolveLoraPinMap(env || parsed?.board);
  if (pinMap) {
    parts.push(formatPinMapForPrompt(pinMap));
  }

  if (parts.length <= 1) return null;
  return parts.join("\n");
}
