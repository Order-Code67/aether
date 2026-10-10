import { useEffect, useMemo, useRef } from "react";
import {
  Check,
  Eraser,
  Eye,
  FileDown,
  Send,
  Settings2,
  Square,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { basename } from "@/lib/paths";
import {
  editButtonLabel,
  extractAgentEdits,
  type AgentEdit,
} from "@/lib/patchEdit";
import { useAgentStore } from "@/stores/agentStore";

function EditPreviewPanel() {
  const preview = useAgentStore((s) => s.preview);
  const confirmPreview = useAgentStore((s) => s.confirmPreview);
  const clearPreview = useAgentStore((s) => s.clearPreview);

  if (!preview) return null;

  return (
    <div className="border-t border-aether-border bg-aether-activity">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium text-aether-fg">
            Preview · {basename(preview.path)}
          </p>
          <p className="truncate text-[10px] text-aether-fg-dim">
            {preview.summary}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => {
              void confirmPreview();
            }}
            className="flex h-6 items-center gap-1 rounded bg-aether-accent px-2 text-[11px] text-white hover:opacity-90"
          >
            <Check size={12} />
            Apply
          </button>
          <button
            type="button"
            title="Close preview"
            onClick={clearPreview}
            className="flex h-6 w-6 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
          >
            <X size={13} />
          </button>
        </div>
      </div>
      <div className="aether-scroll max-h-36 overflow-auto border-t border-aether-border px-3 py-1.5 font-mono text-[10px] leading-4">
        {preview.removed.map((line, i) => (
          <div key={`r-${i}`} className="whitespace-pre-wrap text-aether-danger">
            -{line}
          </div>
        ))}
        {preview.added.map((line, i) => (
          <div key={`a-${i}`} className="whitespace-pre-wrap text-emerald-400">
            +{line}
          </div>
        ))}
        {preview.removed.length === 0 && preview.added.length === 0 && (
          <p className="text-aether-fg-dim">(no line changes)</p>
        )}
      </div>
    </div>
  );
}

function AssistantMessage({
  content,
  streaming,
}: {
  content: string;
  streaming?: boolean;
}) {
  const previewEdit = useAgentStore((s) => s.previewEdit);
  const applyEdit = useAgentStore((s) => s.applyEdit);
  const previewEditId = useAgentStore((s) => s.previewEditId);
  const edits = useMemo(() => extractAgentEdits(content), [content]);

  return (
    <div className="rounded bg-aether-bg px-2 py-1.5 text-xs leading-relaxed text-aether-fg">
      <div className="mb-1 text-[10px] uppercase tracking-wide text-aether-fg-dim">
        Agent{streaming ? " · streaming" : ""}
      </div>
      <div className="whitespace-pre-wrap break-words">{content}</div>
      {!streaming && edits.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-aether-border pt-2">
          {edits.map((edit: AgentEdit, index) => (
            <div key={edit.id} className="flex gap-1">
              <button
                type="button"
                title="Preview changes"
                onClick={() => {
                  void previewEdit(edit);
                }}
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded border border-aether-border text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg",
                  previewEditId === edit.id &&
                    "border-aether-accent bg-aether-accent-muted text-aether-fg",
                )}
              >
                <Eye size={12} />
              </button>
              <button
                type="button"
                title={edit.pathLabel ?? "Apply to active file"}
                onClick={() => {
                  void applyEdit(edit);
                }}
                className="flex min-w-0 flex-1 items-center gap-1.5 rounded border border-aether-border px-2 py-1 text-left text-[11px] text-aether-fg hover:bg-aether-surface-raised"
              >
                <FileDown size={12} className="shrink-0 text-aether-accent" />
                <span className="truncate">
                  {editButtonLabel(edit, index, edits.length)}
                  <span className="ml-1 text-aether-fg-dim">
                    {edit.kind === "search-replace"
                      ? "patch"
                      : edit.kind === "unified-diff"
                        ? "diff"
                        : "full"}
                  </span>
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AgentPanel() {
  const messages = useAgentStore((s) => s.messages);
  const draft = useAgentStore((s) => s.draft);
  const busy = useAgentStore((s) => s.busy);
  const error = useAgentStore((s) => s.error);
  const applyStatus = useAgentStore((s) => s.applyStatus);
  const showSettings = useAgentStore((s) => s.showSettings);
  const baseUrl = useAgentStore((s) => s.baseUrl);
  const apiKey = useAgentStore((s) => s.apiKey);
  const model = useAgentStore((s) => s.model);
  const includeActiveFile = useAgentStore((s) => s.includeActiveFile);
  const includeProblems = useAgentStore((s) => s.includeProblems);
  const setDraft = useAgentStore((s) => s.setDraft);
  const setShowSettings = useAgentStore((s) => s.setShowSettings);
  const setBaseUrl = useAgentStore((s) => s.setBaseUrl);
  const setApiKey = useAgentStore((s) => s.setApiKey);
  const setModel = useAgentStore((s) => s.setModel);
  const setIncludeActiveFile = useAgentStore((s) => s.setIncludeActiveFile);
  const setIncludeProblems = useAgentStore((s) => s.setIncludeProblems);
  const clearChat = useAgentStore((s) => s.clearChat);
  const send = useAgentStore((s) => s.send);
  const cancel = useAgentStore((s) => s.cancel);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, busy]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-9 shrink-0 items-center justify-between px-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-aether-fg-muted">
          AI Agent
        </h2>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="Clear chat"
            aria-label="Clear chat"
            onClick={clearChat}
            className="flex h-6 w-6 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
          >
            <Eraser size={13} />
          </button>
          <button
            type="button"
            title="Agent settings"
            aria-label="Agent settings"
            aria-pressed={showSettings}
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg",
              showSettings && "bg-aether-surface-raised text-aether-fg",
            )}
          >
            <Settings2 size={13} />
          </button>
        </div>
      </header>

      {showSettings && (
        <div className="space-y-2 border-b border-aether-border px-3 pb-3 text-xs">
          <label className="block">
            <span className="text-[11px] text-aether-fg-dim">Base URL</span>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="mt-0.5 w-full rounded border border-aether-border bg-aether-bg px-2 py-1 text-aether-fg outline-none focus:border-aether-accent"
              placeholder="https://api.openai.com/v1"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-aether-fg-dim">API key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="mt-0.5 w-full rounded border border-aether-border bg-aether-bg px-2 py-1 text-aether-fg outline-none focus:border-aether-accent"
              placeholder="sk-…"
              autoComplete="off"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-aether-fg-dim">Model</span>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-0.5 w-full rounded border border-aether-border bg-aether-bg px-2 py-1 text-aether-fg outline-none focus:border-aether-accent"
              placeholder="gpt-4o-mini"
            />
          </label>
          <label className="flex items-center gap-2 text-aether-fg">
            <input
              type="checkbox"
              checked={includeActiveFile}
              onChange={(e) => setIncludeActiveFile(e.target.checked)}
            />
            Attach active file
          </label>
          <label className="flex items-center gap-2 text-aether-fg">
            <input
              type="checkbox"
              checked={includeProblems}
              onChange={(e) => setIncludeProblems(e.target.checked)}
            />
            Attach Problems
          </label>
          <p className="text-[11px] leading-relaxed text-aether-fg-dim">
            Supports full-file fences,{" "}
            <code className="text-aether-fg">SEARCH/REPLACE</code> patches, and{" "}
            <code className="text-aether-fg">diff</code> hunks with Preview.
          </p>
        </div>
      )}

      <div
        ref={listRef}
        className="aether-scroll min-h-0 flex-1 space-y-3 overflow-auto px-3 py-2"
      >
        {messages.length === 0 ? (
          <p className="text-xs leading-relaxed text-aether-fg-dim">
            Ask about firmware, builds, or serial debugging. Prefer asking for a
            SEARCH/REPLACE or diff patch — Preview then Apply.
          </p>
        ) : (
          messages.map((msg) =>
            msg.role === "user" ? (
              <div
                key={msg.id}
                className="rounded bg-aether-accent-muted px-2 py-1.5 text-xs leading-relaxed whitespace-pre-wrap break-words text-aether-fg"
              >
                <div className="mb-1 text-[10px] uppercase tracking-wide text-aether-fg-dim">
                  You
                </div>
                {msg.content}
              </div>
            ) : (
              <AssistantMessage
                key={msg.id}
                content={msg.content}
                streaming={msg.streaming}
              />
            ),
          )
        )}
      </div>

      <EditPreviewPanel />

      {(error || applyStatus) && (
        <div
          className={cn(
            "border-t border-aether-border px-3 py-1.5 text-[11px]",
            error ? "text-aether-danger" : "text-aether-fg-muted",
          )}
        >
          {error ?? applyStatus}
        </div>
      )}

      <div className="shrink-0 border-t border-aether-border p-2">
        <div className="flex items-end gap-1">
          <textarea
            value={draft}
            rows={3}
            disabled={busy}
            placeholder="Ask the agent…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            className="aether-scroll min-h-[64px] flex-1 resize-none rounded border border-aether-border bg-aether-bg px-2 py-1.5 text-xs text-aether-fg outline-none focus:border-aether-accent disabled:opacity-50"
          />
          {busy ? (
            <button
              type="button"
              title="Stop"
              onClick={() => {
                void cancel();
              }}
              className="flex h-8 w-8 items-center justify-center rounded border border-aether-border text-aether-danger hover:bg-aether-surface-raised"
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              type="button"
              title="Send"
              disabled={!draft.trim()}
              onClick={() => {
                void send();
              }}
              className="flex h-8 w-8 items-center justify-center rounded bg-aether-accent text-white hover:opacity-90 disabled:opacity-40"
            >
              <Send size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
