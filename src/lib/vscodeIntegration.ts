import { invoke } from "@tauri-apps/api/core";
import type { MessageKey } from "@/i18n";
import { errorMessage } from "@/lib/errors";
import { isTauriRuntime } from "@/lib/tauri";
import { useSettingsStore } from "@/stores/settingsStore";

export type VscodeGenerateResult = {
  created: string[];
  merged: string[];
  skipped: string[];
};

export type VsCodeInfo = {
  installed: boolean;
  path: string | null;
};

export async function detectVsCode(): Promise<VsCodeInfo> {
  if (!isTauriRuntime()) {
    return { installed: false, path: null };
  }
  return invoke<VsCodeInfo>("vscode_detect");
}

export async function openInVsCode(folderPath: string): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error("VS Code integration requires the desktop app.");
  }
  await invoke("open_external_vscode", { path: folderPath });
}

/**
 * Write / merge `.vscode` helpers via Rust (reliable FS ACL).
 * Creates extensions.json / settings.json (merge if present) and
 * c_cpp_properties.json when missing.
 */
export async function generateVsCodeConfig(
  workspaceRoot: string,
): Promise<VscodeGenerateResult> {
  if (!isTauriRuntime()) {
    throw new Error("VS Code integration requires the desktop app.");
  }
  return invoke<VscodeGenerateResult>("vscode_generate_config", {
    path: workspaceRoot,
  });
}

/** Map Rust sentinel / errors to i18n keys. */
export function vscodeErrorKey(
  err: unknown,
): "vscode.cliMissing" | "vscode.openFailed" {
  const msg = errorMessage(err, "");
  if (msg.includes("VSCODE_CLI_MISSING")) return "vscode.cliMissing";
  return "vscode.openFailed";
}

/** Status-bar notice duration for VS Code feedback (longer than default). */
export const VSCODE_NOTICE_MS = 5500;

/** Hard failures: long status notice + modal so the user always sees feedback. */
export function notifyVsCodeFailure(message: string): void {
  useSettingsStore.getState().flashNotice(message, VSCODE_NOTICE_MS);
  window.alert(message);
}

export function formatGenerateSummary(
  result: VscodeGenerateResult,
  translate: (key: MessageKey, params?: Record<string, string | number>) => string,
): string {
  const parts = [
    ...result.created.map((f) => translate("vscode.created", { file: f })),
    ...result.merged.map((f) => translate("vscode.merged", { file: f })),
    ...result.skipped.map((f) => translate("vscode.skipped", { file: f })),
  ];
  return parts.length > 0 ? parts.join("\n") : translate("vscode.generateDone");
}
