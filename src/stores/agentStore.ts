import { create } from "zustand";
import { persist } from "zustand/middleware";
import { t } from "@/hooks/useI18n";
import {
  cancelChatStream,
  chatCompletion,
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
import { shouldHardBlockNetwork } from "@/lib/offline";
import {
  applyAgentEdit,
  extractAgentEdits,
  previewAgentEdit,
  type AgentEdit,
  type EditPreview,
} from "@/lib/patchEdit";
import { joinPath } from "@/lib/paths";
import { buildBoardHardwareContext } from "@/lib/projectBoardContext";
import { isTauriRuntime } from "@/lib/tauri";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useEditorStore } from "@/stores/editorStore";
import { usePlatformIoStore } from "@/stores/platformioStore";
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
  includeBoardHardware: boolean;
  showSettings: boolean;
  busy: boolean;
  error: string | null;
  /** Last failure reason for support reports (survives dismiss if needed). */
  lastErrorReason: string | null;
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
  setIncludeBoardHardware: (v: boolean) => void;
  setShowSettings: (v: boolean) => void;
  setDraft: (v: string) => void;
  setPendingAttachments: (items: PendingAttachment[]) => void;
  removePendingAttachment: (id: string) => void;
  clearPendingAttachments: () => void;
  clearChat: () => void;
  clearError: () => void;
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
    "For PlatformIO projects, prefer SEARCH/REPLACE on platformio.ini for board=, lib_deps, and LoRa build_flags (AETHER_LORA_* / region). Keep pin maps and region consistent with the selected env.",
    "When board/radio context is attached, use those NSS/DIO/RST/OLED pins and lib_deps instead of guessing.",
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

async function buildContextBlock(): Promise<string> {
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

  if (state.includeBoardHardware) {
    const pio = usePlatformIoStore.getState();
    const ws = useWorkspaceStore.getState();
    const tabs = useEditorStore.getState().tabs;
    const iniTab = tabs.find((t) =>
      /platformio\.ini$/i.test(t.path.replace(/\\/g, "/")),
    );
    let iniText = iniTab?.content ?? null;
    if (!iniText && isTauriRuntime() && ws.rootPath && pio.isProject) {
      try {
        iniText = await readTextFile(joinPath(ws.rootPath, "platformio.ini"));
      } catch {
        iniText = null;
      }
    }
    const boardCtx = buildBoardHardwareContext({
      selectedEnv: pio.selectedEnv,
      iniText,
    });
    if (boardCtx) chunks.push(boardCtx);
  }

  return chunks.join("\n\n");
}

function finishAssistant(
  assistantId: string,
  patch: { content?: string; error?: string | null },
) {
  useAgentStore.setState((s) => {
    const error = patch.error === undefined ? s.error : patch.error;
    return {
      busy: false,
      error,
      lastErrorReason: error ?? s.lastErrorReason,
      messages: s.messages.map((m) =>
        m.id === assistantId
          ? {
              ...m,
              streaming: false,
              content:
                patch.content !== undefined ? patch.content : m.content,
            }
          : m,
      ),
    };
  });
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set, get) => ({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "",
      model: "gpt-4o-mini",
      includeActiveFile: true,
      includeProblems: true,
      includeBoardHardware: true,
      showSettings: false,
      busy: false,
      error: null,
      lastErrorReason: null,
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
      setIncludeBoardHardware: (v) => set({ includeBoardHardware: v }),
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

      clearError: () => set({ error: null }),

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
          const msg =
            error instanceof Error
              ? error.message
              : t("agent.errorRequestFailed");
          set({
            preview: null,
            previewEditId: null,
            error: msg,
            lastErrorReason: msg,
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
          const msg =
            error instanceof Error
              ? error.message
              : t("agent.errorRequestFailed");
          set({
            error: msg,
            lastErrorReason: msg,
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
          const msg =
            error instanceof Error
              ? error.message
              : t("agent.errorRequestFailed");
          set({
            error: msg,
            lastErrorReason: msg,
          });
        }
      },

      send: async () => {
        const text = get().draft.trim();
        const attachments = get().pendingAttachments;
        if ((!text && attachments.length === 0) || get().busy) return;

        if (!isTauriRuntime()) {
          const msg = t("agent.errorDesktopOnly");
          set({ error: msg, lastErrorReason: msg });
          return;
        }
        // Hard-block only on navigator.onLine === false. Probe failures
        // (gstatic etc.) must not silence the agent while the LLM API works.
        if (shouldHardBlockNetwork()) {
          const msg = t("agent.errorOffline");
          set({ error: msg, lastErrorReason: msg });
          return;
        }
        if (!get().apiKey.trim()) {
          const msg = t("agent.errorApiKey");
          set({
            error: msg,
            lastErrorReason: msg,
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

        const context = await buildContextBlock();
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

        const requestOpts = {
          baseUrl: get().baseUrl,
          apiKey: get().apiKey,
          model: get().model,
          messages: history,
        };

        let unlistenChunk: (() => void) | undefined;
        let unlistenStatus: (() => void) | undefined;
        let cancelled = false;
        let streamError: string | null = null;

        try {
          // Register listeners BEFORE invoke so early chunks/status are not lost.
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

          await chatStream(requestOpts);

          const streamed = get().messages.find((m) => m.id === assistantId);
          const empty = !streamed?.content.trim();

          if (!cancelled && !streamError && empty) {
            // Some providers stream empty / array-only deltas we missed — retry once.
            try {
              const fallback = await chatCompletion(requestOpts);
              if (fallback.trim()) {
                finishAssistant(assistantId, {
                  content: fallback,
                  error: null,
                });
                return;
              }
              finishAssistant(assistantId, {
                error: t("agent.errorEmpty"),
              });
              return;
            } catch (fallbackErr) {
              const msg =
                fallbackErr instanceof Error
                  ? fallbackErr.message
                  : t("agent.errorRequestFailed");
              finishAssistant(assistantId, { error: msg });
              return;
            }
          }

          const error =
            streamError ??
            (empty && !cancelled ? t("agent.errorEmpty") : null);
          finishAssistant(assistantId, { error });
        } catch (error) {
          const msg =
            streamError ??
            (error instanceof Error
              ? error.message
              : t("agent.errorRequestFailed"));
          finishAssistant(assistantId, { error: msg });
        } finally {
          unlistenChunk?.();
          unlistenStatus?.();
          // Guarantee busy clears even if listeners never fired (invoke failed early).
          if (get().busy) {
            set((s) => ({
              busy: false,
              messages: s.messages.map((m) =>
                m.id === assistantId ? { ...m, streaming: false } : m,
              ),
            }));
          }
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
        includeBoardHardware: state.includeBoardHardware,
      }),
    },
  ),
);
