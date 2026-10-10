import { invoke } from "@tauri-apps/api/core";
import { exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { joinPath } from "@/lib/paths";
import { isTauriRuntime } from "@/lib/tauri";

const PIO_EXTENSION = "platformio.platformio-ide";

const DEFAULT_EXTENSIONS = {
  recommendations: [PIO_EXTENSION],
};

const DEFAULT_SETTINGS: Record<string, unknown> = {
  "files.associations": {
    "*.ino": "cpp",
  },
  "C_Cpp.errorSquiggles": "enabled",
};

const DEFAULT_CPP_PROPERTIES = {
  configurations: [
    {
      name: "PlatformIO",
      includePath: ["${workspaceFolder}/**"],
      defines: [] as string[],
      compilerPath: "",
      cStandard: "c11",
      cppStandard: "c++17",
      intelliSenseMode: "windows-gcc-x64",
      compileCommands:
        "${workspaceFolder}/.pio/build/*/compile_commands.json",
    },
  ],
  version: 4,
};

export type VscodeGenerateResult = {
  created: string[];
  merged: string[];
  skipped: string[];
};

function mergeRecommendations(existing: unknown): { recommendations: string[] } {
  const recs = new Set<string>([PIO_EXTENSION]);
  if (
    existing &&
    typeof existing === "object" &&
    Array.isArray((existing as { recommendations?: unknown }).recommendations)
  ) {
    for (const r of (existing as { recommendations: unknown[] })
      .recommendations) {
      if (typeof r === "string" && r.trim()) recs.add(r.trim());
    }
  }
  return { recommendations: [...recs] };
}

function mergeSettings(
  existing: Record<string, unknown> | null,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(existing ?? {}) };
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (!(key in out)) {
      out[key] = value;
      continue;
    }
    if (
      key === "files.associations" &&
      value &&
      typeof value === "object" &&
      out[key] &&
      typeof out[key] === "object"
    ) {
      out[key] = {
        ...(value as Record<string, unknown>),
        ...(out[key] as Record<string, unknown>),
      };
    }
  }
  return out;
}

async function readJsonObject(
  path: string,
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    return { ok: true, value: JSON.parse(await readTextFile(path)) };
  } catch {
    return { ok: false };
  }
}

export async function openInVsCode(folderPath: string): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error("VS Code integration requires the desktop app.");
  }
  await invoke("open_external_vscode", { path: folderPath });
}

/**
 * Write / merge `.vscode` helper files.
 * Existing `c_cpp_properties.json` is only overwritten after confirmOverwrite.
 * `extensions.json` / `settings.json` merge non-destructively when valid JSON.
 */
export async function generateVsCodeConfig(
  workspaceRoot: string,
  options?: { confirmOverwrite?: (relativePath: string) => boolean },
): Promise<VscodeGenerateResult> {
  if (!isTauriRuntime()) {
    throw new Error("VS Code integration requires the desktop app.");
  }

  const confirm = options?.confirmOverwrite;
  const vscodeDir = joinPath(workspaceRoot, ".vscode");
  const created: string[] = [];
  const merged: string[] = [];
  const skipped: string[] = [];

  if (!(await exists(vscodeDir))) {
    await mkdir(vscodeDir, { recursive: true });
  }

  // extensions.json — merge recommendations
  {
    const rel = ".vscode/extensions.json";
    const path = joinPath(vscodeDir, "extensions.json");
    const fileExisted = await exists(path);
    let payload = DEFAULT_EXTENSIONS;
    if (fileExisted) {
      const parsed = await readJsonObject(path);
      if (parsed.ok) {
        payload = mergeRecommendations(parsed.value);
      } else if (!confirm?.(rel)) {
        skipped.push(rel);
      }
    }
    if (!skipped.includes(rel)) {
      await writeTextFile(path, `${JSON.stringify(payload, null, 2)}\n`);
      if (fileExisted) merged.push(rel);
      else created.push(rel);
    }
  }

  // settings.json — merge missing keys
  {
    const rel = ".vscode/settings.json";
    const path = joinPath(vscodeDir, "settings.json");
    const fileExisted = await exists(path);
    let existing: Record<string, unknown> | null = null;
    if (fileExisted) {
      const parsed = await readJsonObject(path);
      if (
        parsed.ok &&
        parsed.value &&
        typeof parsed.value === "object" &&
        !Array.isArray(parsed.value)
      ) {
        existing = parsed.value as Record<string, unknown>;
      } else if (!confirm?.(rel)) {
        skipped.push(rel);
      } else {
        existing = {};
      }
    }
    if (!skipped.includes(rel)) {
      const next = mergeSettings(existing);
      await writeTextFile(path, `${JSON.stringify(next, null, 2)}\n`);
      if (fileExisted) merged.push(rel);
      else created.push(rel);
    }
  }

  // c_cpp_properties.json — create or confirm overwrite
  {
    const rel = ".vscode/c_cpp_properties.json";
    const path = joinPath(vscodeDir, "c_cpp_properties.json");
    if (await exists(path)) {
      if (confirm?.(rel)) {
        await writeTextFile(
          path,
          `${JSON.stringify(DEFAULT_CPP_PROPERTIES, null, 2)}\n`,
        );
        merged.push(rel);
      } else {
        skipped.push(rel);
      }
    } else {
      await writeTextFile(
        path,
        `${JSON.stringify(DEFAULT_CPP_PROPERTIES, null, 2)}\n`,
      );
      created.push(rel);
    }
  }

  return { created, merged, skipped };
}

/** Map Rust sentinel / errors to i18n keys. */
export function vscodeErrorKey(err: unknown): "vscode.cliMissing" | "vscode.openFailed" {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (msg.includes("VSCODE_CLI_MISSING")) return "vscode.cliMissing";
  return "vscode.openFailed";
}
