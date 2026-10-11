import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import {
  AGENT_TEXT_FILE_EXTENSIONS,
  budgetAttachments,
  classifyAttachmentName,
  type PendingAttachment,
} from "@/lib/agentAttachments";
import { basename } from "@/lib/paths";
import { isTauriRuntime } from "@/lib/tauri";

export type AttachLoadResult = {
  attachments: PendingAttachment[];
  skippedImages: string[];
  skippedUnsupported: string[];
  errors: string[];
};

function nextId(name: string): string {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${name}`;
}

export async function pickAgentAttachmentPaths(): Promise<string[] | null> {
  if (!isTauriRuntime()) return null;
  const chosen = await open({
    multiple: true,
    title: "Attach files to AI chat",
    filters: [
      {
        name: "Text / code",
        extensions: AGENT_TEXT_FILE_EXTENSIONS,
      },
      { name: "All", extensions: ["*"] },
    ],
  });
  if (chosen == null) return null;
  return Array.isArray(chosen) ? chosen : [chosen];
}

export async function loadAttachmentsFromPaths(
  paths: string[],
  existing: PendingAttachment[] = [],
): Promise<AttachLoadResult> {
  const skippedImages: string[] = [];
  const skippedUnsupported: string[] = [];
  const errors: string[] = [];
  const loaded: Array<{
    id: string;
    name: string;
    path?: string;
    content: string;
  }> = [];

  for (const path of paths) {
    const name = basename(path);
    const kind = classifyAttachmentName(name);
    if (kind === "image") {
      skippedImages.push(name);
      continue;
    }
    if (kind === "unsupported") {
      skippedUnsupported.push(name);
      continue;
    }
    try {
      const content = await readTextFile(path);
      loaded.push({ id: nextId(name), name, path, content });
    } catch (e) {
      errors.push(
        e instanceof Error ? `${name}: ${e.message}` : `${name}: read failed`,
      );
    }
  }

  const attachments = budgetAttachments([...existing, ...loaded]);
  return { attachments, skippedImages, skippedUnsupported, errors };
}

export async function loadAttachmentsFromFiles(
  files: File[],
  existing: PendingAttachment[] = [],
): Promise<AttachLoadResult> {
  const skippedImages: string[] = [];
  const skippedUnsupported: string[] = [];
  const errors: string[] = [];
  const loaded: Array<{
    id: string;
    name: string;
    path?: string;
    content: string;
  }> = [];

  for (const file of files) {
    const name = file.name;
    const kind = classifyAttachmentName(name);
    if (kind === "image") {
      skippedImages.push(name);
      continue;
    }
    if (kind === "unsupported") {
      skippedUnsupported.push(name);
      continue;
    }
    try {
      const content = await file.text();
      const path =
        typeof (file as File & { path?: string }).path === "string"
          ? (file as File & { path?: string }).path
          : undefined;
      loaded.push({ id: nextId(name), name, path, content });
    } catch (e) {
      errors.push(
        e instanceof Error ? `${name}: ${e.message}` : `${name}: read failed`,
      );
    }
  }

  const attachments = budgetAttachments([...existing, ...loaded]);
  return { attachments, skippedImages, skippedUnsupported, errors };
}
