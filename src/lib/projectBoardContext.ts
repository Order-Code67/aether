import {
  formatPinMapForPrompt,
  resolveLoraPinMap,
} from "@/lib/hardwarePinMaps";

const MAX_ENV_SNIPPET = 3_500;

/** Split platformio.ini into named sections (preserves original text). */
export function splitPlatformioIniSections(
  ini: string,
): Array<{ name: string; body: string }> {
  const lines = ini.split(/\r?\n/);
  const sections: Array<{ name: string; body: string }> = [];
  let currentName = "";
  let currentLines: string[] = [];
  const flush = () => {
    if (currentName || currentLines.length) {
      sections.push({ name: currentName, body: currentLines.join("\n") });
    }
    currentLines = [];
  };
  for (const line of lines) {
    const header = line.match(/^\[([^\]]+)\]\s*$/);
    if (header) {
      flush();
      currentName = header[1] ?? "";
      currentLines = [line];
      continue;
    }
    currentLines.push(line);
  }
  flush();
  return sections;
}

/** Body of `[env:name]` (or first env) for SEARCH/REPLACE accuracy. */
export function extractPlatformioEnvSection(
  ini: string,
  envName?: string | null,
): string | null {
  const sections = splitPlatformioIniSections(ini);
  const wanted = envName?.trim();
  if (wanted) {
    const exact = sections.find(
      (s) =>
        s.name === `env:${wanted}` ||
        s.name.toLowerCase() === `env:${wanted.toLowerCase()}`,
    );
    if (exact) return exact.body;
  }
  const firstEnv = sections.find((s) => /^env:/i.test(s.name));
  return firstEnv?.body ?? null;
}

/** Extract board= and lib_deps lines from platformio.ini text (optionally one env). */
export function parsePlatformioIniSnippet(
  ini: string,
  envName?: string | null,
): {
  board: string | null;
  libDeps: string[];
  buildFlags: string[];
} {
  const scoped = envName ? extractPlatformioEnvSection(ini, envName) : null;
  const text = scoped ?? ini;

  const boardMatch = text.match(/^\s*board\s*=\s*(\S+)/m);
  const libDeps: string[] = [];
  const buildFlags: string[] = [];
  const lines = text.split(/\r?\n/);
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
    ? parsePlatformioIniSnippet(options.iniText, env || null)
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

  if (options.iniText) {
    const section = extractPlatformioEnvSection(options.iniText, env || null);
    if (section) {
      const body =
        section.length > MAX_ENV_SNIPPET
          ? `${section.slice(0, MAX_ENV_SNIPPET)}\n…(truncated)`
          : section;
      parts.push(`platformio.ini env section:\n\`\`\`ini\n${body}\n\`\`\``);
    }
  }

  const pinMap = resolveLoraPinMap(env || parsed?.board);
  if (pinMap) {
    parts.push(formatPinMapForPrompt(pinMap));
  }

  if (parts.length <= 1) return null;
  return parts.join("\n");
}
