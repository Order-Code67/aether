import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  cancelChatStream,
  chatStream,
  listenAiChunk,
  listenAiStatus,
  type AiMessage,
} from "@/lib/ai";
import {
  attachmentDisplaySuffix,
  packAttachmentsBlock,
  type PendingAttachment,
} from "@/lib/agentAttachments";
import { writeEditorContent } from "@/lib/applyEdit";
import {
  applyAgentEdit,
  extractAgentEdits,
  previewAgentEdit,
  type AgentEdit,
  type EditPreview,
} from "@/lib/patchEdit";
import { isTauriRuntime } from "@/lib/tauri";
import { useEditorStore } from "@/stores/editorStore";
import { useProblemsStore } from "@/stores/problemsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

const MAX_FILE_CHARS = 12_000;
const MAX_HISTORY = 40;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  at: number;
  streaming?: boolean;
}

interface AgentState {
  baseUrl: string;
  apiKey: string;
  model: string;
  includeActiveFile: boolean;
  includeProblems: boolean;
  showSettings: boolean;
  busy: boolean;
  error: string | null;
  messages: ChatMessage[];
  draft: string;
  pendingAttachments: PendingAttachment[];
  applyStatus: string | null;
  preview: EditPreview | null;
  previewEditId: string | null;
  setBaseUrl: (v: string) => void;
  setApiKey: (v: string) => void;
  setModel: (v: string) => void;
  setIncludeActiveFile: (v: boolean) => void;
  setIncludeProblems: (v: boolean) => void;
  setShowSettings: (v: boolean) => void;
  setDraft: (v: string) => void;
  setPendingAttachments: (items: PendingAttachment[]) => void;
  removePendingAttachment: (id: string) => void;
  clearPendingAttachments: () => void;
  clearChat: () => void;
  clearPreview: () => void;
  cancel: () => Promise<void>;
  send: () => Promise<void>;
  editsFor: (messageId: string) => AgentEdit[];
  previewEdit: (edit: AgentEdit) => Promise<void>;
  applyEdit: (edit: AgentEdit) => Promise<void>;
  confirmPreview: () => Promise<void>;
}

function buildSystemPrompt(): string {
  const { kind, rootName, folders, activeFolderPath } =
    useWorkspaceStore.getState();
  const parts = [
    "You are Aether Agent, an expert assistant for robotics, drones, and embedded systems (Arduino, ESP32, ESP8266, PlatformIO, C/C++).",
    "Be concise and practical. Prefer correct code and clear flashing/debug steps.",
    "Prefer partial edits over rewriting whole files.",
    "For a small change, use a SEARCH/REPLACE block (exact current text in SEARCH):",
    "File: src/main.cpp",
    "<<<<<<< SEARCH",
    "old lines",
    "=======",
    "new lines",
    ">>>>>>> REPLACE",
    "Or a unified diff in a ```diff fence with --- / +++ paths.",
    "For a full-file rewrite only when necessary:",
    "```cpp src/main.cpp",
    "// full file contents",
    "```",
    "The IDE can preview and apply these edits with one click.",
  ];
  if (kind === "folder" && folders.length > 0) {
    const list = folders
      .map((f) =>
        f.path === activeFolderPath ? `${f.name} (active)` : f.name,
      )
      .join(", ");
    parts.push(`Workspace roots: ${list}`);
    parts.push(`Active root for relative paths: ${rootName}`);
  } else if (kind !== "none" && rootName) {
    parts.push(`Workspace: ${rootName}`);
  }
  return parts.join("\n");
}

function buildContextBlock(): string {
  const state = useAgentStore.getState();
  const chunks: string[] = [];

  if (state.includeActiveFile) {
    const tab = useEditorStore.getState().tabs.find(
      (t) => t.id === useEditorStore.getState().activeTabId,
    );
    if (tab) {
      const body =
        tab.content.length > MAX_FILE_CHARS
          ? `${tab.content.slice(0, MAX_FILE_CHARS)}\n…(truncated)`
          : tab.content;
      chunks.push(`Active file: ${tab.path}\n\`\`\`\n${body}\n\`\`\``);
    }
  }

  if (state.includeProblems) {
    const problems = useProblemsStore.getState().problems.slice(0, 12);
    if (problems.length > 0) {
      const lines = problems.map(
        (p) =>
          `- [${p.severity}] ${p.absolutePath ?? p.file}:${p.line}:${p.column} ${p.message}`,
      );
      chunks.push(`Current build problems:\n${lines.join("\n")}`);
    }
  }

  return chunks.join("\n\n");
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set, get) => ({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "",
      model: "gpt-4o-mini",
      includeActiveFile: true,
      includeProblems: true,
      showSettings: false,
      busy: false,
      error: null,
      messages: [],
      draft: "",
      pendingAttachments: [],
      applyStatus: null,
      preview: null,
      previewEditId: null,

      setBaseUrl: (v) => set({ baseUrl: v }),
      setApiKey: (v) => set({ apiKey: v }),
      setModel: (v) => set({ model: v }),
      setIncludeActiveFile: (v) => set({ includeActiveFile: v }),
      setIncludeProblems: (v) => set({ includeProblems: v }),
      setShowSettings: (v) => set({ showSettings: v }),
      setDraft: (v) => set({ draft: v }),
      setPendingAttachments: (items) => set({ pendingAttachments: items }),
      removePendingAttachment: (id) =>
        set((s) => ({
          pendingAttachments: s.pendingAttachments.filter((a) => a.id !== id),
        })),
      clearPendingAttachments: () => set({ pendingAttachments: [] }),

      clearChat: () =>
        set({
          messages: [],
          error: null,
          applyStatus: null,
          preview: null,
          previewEditId: null,
          pendingAttachments: [],
        }),

      clearPreview: () => set({ preview: null, previewEditId: null }),

      cancel: async () => {
        await cancelChatStream();
      },

      editsFor: (messageId) => {
        const msg = get().messages.find((m) => m.id === messageId);
        if (!msg || msg.role !== "assistant") return [];
        return extractAgentEdits(msg.content);
      },

      previewEdit: async (edit) => {
        try {
          const preview = await previewAgentEdit(edit);
          set({
            preview,
            previewEditId: edit.id,
            error: null,
          });
        } catch (error) {
          set({
            preview: null,
            previewEditId: null,
            error:
              error instanceof Error
                ? error.message
                : "Failed to preview edit.",
          });
        }
      },

      applyEdit: async (edit) => {
        try {
          const path = await applyAgentEdit(edit);
          set({
            applyStatus: `Applied to ${path}`,
            error: null,
            preview: null,
            previewEditId: null,
          });
          window.setTimeout(() => {
            if (useAgentStore.getState().applyStatus?.startsWith("Applied")) {
              set({ applyStatus: null });
            }
          }, 2500);
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : "Failed to apply edit.",
          });
        }
      },

      confirmPreview: async () => {
        const preview = get().preview;
        if (!preview) return;
        try {
          await writeEditorContent(preview.path, preview.next);
          set({
            applyStatus: `Applied to ${preview.path}`,
            error: null,
            preview: null,
            previewEditId: null,
          });
          window.setTimeout(() => {
            if (useAgentStore.getState().applyStatus?.startsWith("Applied")) {
              set({ applyStatus: null });
            }
          }, 2500);
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : "Failed to apply preview.",
          });
        }
      },

      send: async () => {
        const text = get().draft.trim();
        const attachments = get().pendingAttachments;
        if ((!text && attachments.length === 0) || get().busy) return;

        if (!isTauriRuntime()) {
          set({
            error: "AI Agent requires the desktop app (npm run tauri:dev).",
          });
          return;
        }
        const { isAppOffline } = await import("@/stores/offlineStore");
        if (isAppOffline()) {
          set({
            error: "Offline — AI requires an internet connection.",
          });
          return;
        }
        if (!get().apiKey.trim()) {
          set({
            error: "Set an API key in Agent settings.",
            showSettings: true,
          });
          return;
        }

        const displayText =
          (text || "(attached files)") + attachmentDisplaySuffix(attachments);
        const userMsg: ChatMessage = {
          id: `u-${Date.now()}`,
          role: "user",
          content: displayText,
          at: Date.now(),
        };
        const assistantId = `a-${Date.now()}`;
        const assistantMsg: ChatMessage = {
          id: assistantId,
          role: "assistant",
          content: "",
          at: Date.now(),
          streaming: true,
        };

        set((s) => ({
          draft: "",
          pendingAttachments: [],
          busy: true,
          error: null,
          applyStatus: null,
          messages: [...s.messages, userMsg, assistantMsg].slice(-MAX_HISTORY),
        }));

        const context = buildContextBlock();
        const attachBlock = packAttachmentsBlock(attachments);
        const requestBody = text || "Please review the attached files.";
        const sections = [
          context,
          attachBlock,
          `User request:\n${requestBody}`,
        ].filter(Boolean);
        const userContent = sections.join("\n\n---\n\n");

        const history: AiMessage[] = [
          { role: "system", content: buildSystemPrompt() },
          ...get()
            .messages.filter((m) => m.role !== "system" && m.id !== assistantId)
            .slice(0, -1)
            .map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          { role: "user", content: userContent },
        ];

        let unlistenChunk: (() => void) | undefined;
        let unlistenStatus: (() => void) | undefined;
        let cancelled = false;
        let streamError: string | null = null;

        try {
          unlistenChunk = await listenAiChunk((payload) => {
            set((s) => ({
              messages: s.messages.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + payload.text, streaming: true }
                  : m,
              ),
            }));
          });

          unlistenStatus = await listenAiStatus((status) => {
            if (status.cancelled) cancelled = true;
            if (status.error) streamError = status.error;
            if (!status.running) {
              set((s) => ({
                busy: false,
                messages: s.messages.map((m) =>
                  m.id === assistantId ? { ...m, streaming: false } : m,
                ),
              }));
            }
          });

          await chatStream({
            baseUrl: get().baseUrl,
            apiKey: get().apiKey,
            model: get().model,
            messages: history,
          });

          set((s) => {
            const msg = s.messages.find((m) => m.id === assistantId);
            const empty = !msg?.content.trim();
            let error = streamError;
            if (!error && empty && !cancelled) {
              error = "Agent returned an empty reply.";
            }
            return {
              busy: false,
              error,
              messages: s.messages.map((m) =>
                m.id === assistantId ? { ...m, streaming: false } : m,
              ),
            };
          });
        } catch (error) {
          set((s) => ({
            busy: false,
            error:
              streamError ??
              (error instanceof Error ? error.message : "Agent request failed."),
            messages: s.messages.map((m) =>
              m.id === assistantId ? { ...m, streaming: false } : m,
            ),
          }));
        } finally {
          unlistenChunk?.();
          unlistenStatus?.();
        }
      },
    }),
    {
      name: "aether-agent",
      partialize: (state) => ({
        baseUrl: state.baseUrl,
        apiKey: state.apiKey,
        model: state.model,
        includeActiveFile: state.includeActiveFile,
        includeProblems: state.includeProblems,
      }),
    },
  ),
);
