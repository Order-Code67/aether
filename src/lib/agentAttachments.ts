/** Pending AI chat attachments (text/code). Images are not sent — backend is string-only. */

export const MAX_ATTACHMENT_TOTAL_CHARS = 150_000;
export const MAX_SINGLE_ATTACHMENT_CHARS = 80_000;

const TEXT_EXTENSIONS = new Set([
  "c",
  "cc",
  "cpp",
  "cxx",
  "h",
  "hh",
  "hpp",
  "hxx",
  "ino",
  "pde",
  "py",
  "rs",
  "go",
  "js",
  "jsx",
  "ts",
  "tsx",
  "mjs",
  "cjs",
  "json",
  "jsonc",
  "md",
  "txt",
  "ini",
  "cfg",
  "conf",
  "toml",
  "yaml",
  "yml",
  "xml",
  "html",
  "htm",
  "css",
  "scss",
  "less",
  "cmake",
  "makefile",
  "mk",
  "sh",
  "bash",
  "ps1",
  "bat",
  "cmd",
  "csv",
  "log",
  "diff",
  "patch",
  "s",
  "asm",
  "ld",
  "lds",
  "ldscript",
]);

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "svg",
  "ico",
]);

export type AttachmentKind = "text" | "image" | "unsupported";

export interface PendingAttachment {
  id: string;
  name: string;
  path?: string;
  content: string;
  truncated: boolean;
}

export function extensionOf(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? name;
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1).toLowerCase();
}

export function classifyAttachmentName(name: string): AttachmentKind {
  const ext = extensionOf(name);
  if (!ext) return "unsupported";
  if (TEXT_EXTENSIONS.has(ext)) return "text";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  // Treat extensionless / unknown small-looking names as unsupported
  return "unsupported";
}

const TRUNCATION_MARKER = "\n…(truncated)";

export function truncateAttachmentText(
  content: string,
  maxChars: number = MAX_SINGLE_ATTACHMENT_CHARS,
): { text: string; truncated: boolean } {
  if (maxChars <= 0) {
    return { text: "", truncated: content.length > 0 };
  }
  if (content.length <= maxChars) {
    return { text: content, truncated: false };
  }
  if (maxChars <= TRUNCATION_MARKER.length) {
    return { text: content.slice(0, maxChars), truncated: true };
  }
  const bodyBudget = maxChars - TRUNCATION_MARKER.length;
  return {
    text: `${content.slice(0, bodyBudget)}${TRUNCATION_MARKER}`,
    truncated: true,
  };
}

/**
 * Fit several text files into a total character budget (largest-first soft trim).
 * Returns packed attachments with per-file truncation flags.
 */
export function budgetAttachments(
  files: Array<{ id?: string; name: string; path?: string; content: string }>,
  maxTotal: number = MAX_ATTACHMENT_TOTAL_CHARS,
  maxSingle: number = MAX_SINGLE_ATTACHMENT_CHARS,
): PendingAttachment[] {
  const out: PendingAttachment[] = [];
  let used = 0;

  for (const file of files) {
    const remaining = maxTotal - used;
    if (remaining <= 0) break;
    const cap = Math.min(maxSingle, remaining);
    const { text, truncated } = truncateAttachmentText(file.content, cap);
    // Account for fence overhead roughly in budget via content length only
    used += text.length;
    out.push({
      id: file.id ?? `att-${out.length}-${file.name}`,
      name: file.name,
      path: file.path,
      content: text,
      truncated,
    });
  }

  return out;
}

/** Format attachments for the model context (not shown as the sole user bubble). */
export function packAttachmentsBlock(attachments: PendingAttachment[]): string {
  if (attachments.length === 0) return "";
  const parts = attachments.map((a) => {
    const label = a.path ? `${a.name} (${a.path})` : a.name;
    const note = a.truncated ? " [truncated]" : "";
    return `Attached file: ${label}${note}\n\`\`\`\n${a.content}\n\`\`\``;
  });
  return `Attached files (${attachments.length}):\n\n${parts.join("\n\n")}`;
}

export function attachmentDisplaySuffix(
  attachments: Array<{ name: string }>,
): string {
  if (attachments.length === 0) return "";
  return `\n\n[${attachments.map((a) => a.name).join(", ")}]`;
}

export const AGENT_TEXT_FILE_EXTENSIONS = [...TEXT_EXTENSIONS].sort();
