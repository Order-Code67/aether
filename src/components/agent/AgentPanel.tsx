import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Eraser,
  Eye,
  FileDown,
  Mic,
  Paperclip,
  Send,
  Settings2,
  Square,
  X,
} from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import type { MessageKey } from "@/i18n";
import {
  loadAttachmentsFromFiles,
  loadAttachmentsFromPaths,
  pickAgentAttachmentPaths,
} from "@/lib/agentAttachIo";
import { cn } from "@/lib/cn";
import { basename } from "@/lib/paths";
import {
  editButtonLabel,
  extractAgentEdits,
  type AgentEdit,
} from "@/lib/patchEdit";
import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
  isWhisperVoiceSupported,
  resolveVoiceInputMode,
  type SpeechRecognitionLike,
  whisperLanguage,
} from "@/lib/speechRecognition";
import {
  classifyMediaError,
  pickAudioMimeType,
  transcribeAudio,
  WhisperTranscribeError,
} from "@/lib/whisperTranscribe";
import { shouldHardBlockNetwork } from "@/lib/offline";
import { useAgentStore } from "@/stores/agentStore";

type VoicePhase = "idle" | "listening" | "transcribing";

function EditPreviewPanel() {
  const { t } = useI18n();
  const preview = useAgentStore((s) => s.preview);
  const confirmPreview = useAgentStore((s) => s.confirmPreview);
  const clearPreview = useAgentStore((s) => s.clearPreview);

  if (!preview) return null;

  return (
    <div className="border-t border-aether-border bg-aether-activity">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium text-aether-fg">
            {t("agent.preview")} · {basename(preview.path)}
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
            {t("agent.apply")}
          </button>
          <button
            type="button"
            title={t("agent.closePreview")}
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
          <p className="text-aether-fg-dim">{t("agent.noLineChanges")}</p>
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
  const { t } = useI18n();
  const previewEdit = useAgentStore((s) => s.previewEdit);
  const applyEdit = useAgentStore((s) => s.applyEdit);
  const previewEditId = useAgentStore((s) => s.previewEditId);
  const edits = useMemo(() => extractAgentEdits(content), [content]);

  return (
    <div className="rounded bg-aether-bg px-2 py-1.5 text-xs leading-relaxed text-aether-fg">
      <div className="mb-1 text-[10px] uppercase tracking-wide text-aether-fg-dim">
        {t("agent.roleAgent")}
        {streaming ? ` · ${t("agent.streaming")}` : ""}
      </div>
      <div className="whitespace-pre-wrap break-words">{content}</div>
      {!streaming && edits.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-aether-border pt-2">
          {edits.map((edit: AgentEdit, index) => (
            <div key={edit.id} className="flex gap-1">
              <button
                type="button"
                title={t("agent.previewChanges")}
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
                title={t("agent.applyTitle")}
                aria-label={edit.pathLabel ?? t("agent.applyActive")}
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

function formatAttachSkipMessage(
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
  result: {
    skippedImages: string[];
    skippedUnsupported: string[];
    errors: string[];
  },
): string | null {
  const parts: string[] = [];
  if (result.skippedImages.length > 0) {
    parts.push(
      t("agent.attachImagesSkipped", {
        names: result.skippedImages.join(", "),
      }),
    );
  }
  if (result.skippedUnsupported.length > 0) {
    parts.push(
      t("agent.attachUnsupported", {
        names: result.skippedUnsupported.join(", "),
      }),
    );
  }
  if (result.errors.length > 0) {
    parts.push(result.errors.join("; "));
  }
  return parts.length > 0 ? parts.join(" ") : null;
}

export function AgentPanel() {
  const { t, locale } = useI18n();
  const messages = useAgentStore((s) => s.messages);
  const draft = useAgentStore((s) => s.draft);
  const pendingAttachments = useAgentStore((s) => s.pendingAttachments);
  const busy = useAgentStore((s) => s.busy);
  const error = useAgentStore((s) => s.error);
  const applyStatus = useAgentStore((s) => s.applyStatus);
  const showSettings = useAgentStore((s) => s.showSettings);
  const baseUrl = useAgentStore((s) => s.baseUrl);
  const apiKey = useAgentStore((s) => s.apiKey);
  const model = useAgentStore((s) => s.model);
  const includeActiveFile = useAgentStore((s) => s.includeActiveFile);
  const includeProblems = useAgentStore((s) => s.includeProblems);
  const includeBoardHardware = useAgentStore((s) => s.includeBoardHardware);
  const setDraft = useAgentStore((s) => s.setDraft);
  const setPendingAttachments = useAgentStore((s) => s.setPendingAttachments);
  const removePendingAttachment = useAgentStore(
    (s) => s.removePendingAttachment,
  );
  const setShowSettings = useAgentStore((s) => s.setShowSettings);
  const setBaseUrl = useAgentStore((s) => s.setBaseUrl);
  const setApiKey = useAgentStore((s) => s.setApiKey);
  const setModel = useAgentStore((s) => s.setModel);
  const setIncludeActiveFile = useAgentStore((s) => s.setIncludeActiveFile);
  const setIncludeProblems = useAgentStore((s) => s.setIncludeProblems);
  const setIncludeBoardHardware = useAgentStore(
    (s) => s.setIncludeBoardHardware,
  );
  const clearChat = useAgentStore((s) => s.clearChat);
  const send = useAgentStore((s) => s.send);
  const cancel = useAgentStore((s) => s.cancel);
  const listRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [voicePhase, setVoicePhase] = useState<VoicePhase>("idle");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const baseDraftRef = useRef("");
  const finalTranscriptRef = useRef("");
  const voiceModeRef = useRef<"webspeech" | "whisper" | null>(null);

  const listening = voicePhase === "listening";
  const transcribing = voicePhase === "transcribing";

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, busy]);

  const stopMediaTracks = () => {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  };

  const resetVoiceUi = () => {
    setVoicePhase("idle");
    voiceModeRef.current = null;
    recognitionRef.current = null;
    mediaRecorderRef.current = null;
    recordChunksRef.current = [];
    stopMediaTracks();
  };

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        // ignore
      }
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const appendTranscript = (text: string) => {
    const piece = text.trim();
    if (!piece) return;
    const base = baseDraftRef.current.trimEnd();
    setDraft(base ? `${base} ${piece}` : piece);
  };

  const voiceErrorMessage = (code: string): string => {
    switch (code) {
      case "no_api_key":
        return t("agent.voiceNoApiKey");
      case "offline":
        return t("agent.voiceOffline");
      case "mic_denied":
        return t("agent.voiceDenied");
      case "unsupported":
        return t("agent.voiceRecorderUnsupported");
      case "timeout":
        return t("agent.voiceTimeout");
      case "empty_audio":
      case "failed":
        return t("agent.voiceFailed");
      default:
        return t("agent.voiceError", { code });
    }
  };

  const canSend = Boolean(draft.trim() || pendingAttachments.length > 0);

  const applyAttachResult = (result: Awaited<
    ReturnType<typeof loadAttachmentsFromPaths>
  >) => {
    setPendingAttachments(result.attachments);
    const skipMsg = formatAttachSkipMessage(t, result);
    if (skipMsg) {
      useAgentStore.setState({ error: skipMsg });
    }
  };

  const onAttachClick = async () => {
    try {
      const paths = await pickAgentAttachmentPaths();
      if (!paths || paths.length === 0) return;
      const result = await loadAttachmentsFromPaths(paths, pendingAttachments);
      applyAttachResult(result);
    } catch (e) {
      useAgentStore.setState({
        error:
          e instanceof Error ? e.message : t("agent.attachFailed"),
      });
    }
  };

  const onDropFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    try {
      const result = await loadAttachmentsFromFiles(list, pendingAttachments);
      applyAttachResult(result);
    } catch (e) {
      useAgentStore.setState({
        error:
          e instanceof Error ? e.message : t("agent.attachFailed"),
      });
    }
  };

  const stopVoice = () => {
    if (voiceModeRef.current === "webspeech") {
      recognitionRef.current?.stop();
      setVoicePhase("idle");
      voiceModeRef.current = null;
      recognitionRef.current = null;
      return;
    }
    if (voiceModeRef.current === "whisper") {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          resetVoiceUi();
        }
      } else {
        resetVoiceUi();
      }
    }
  };

  const startWebSpeech = () => {
    const rec = createSpeechRecognition(locale);
    if (!rec) {
      useAgentStore.setState({ error: t("agent.voiceUnsupported") });
      return;
    }
    baseDraftRef.current = draft.trimEnd();
    finalTranscriptRef.current = "";
    recognitionRef.current = rec;
    voiceModeRef.current = "webspeech";
    rec.onresult = (ev) => {
      let interim = "";
      let finals = finalTranscriptRef.current;
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const piece = ev.results[i]![0]!.transcript;
        if (ev.results[i]!.isFinal) {
          finals = `${finals}${piece}`;
        } else {
          interim += piece;
        }
      }
      finalTranscriptRef.current = finals;
      const joined = `${finals}${interim}`.trim();
      const base = baseDraftRef.current;
      setDraft(base ? `${base} ${joined}` : joined);
    };
    rec.onerror = (ev) => {
      resetVoiceUi();
      const code = ev.error ?? "";
      if (code === "not-allowed" || code === "service-not-allowed") {
        useAgentStore.setState({ error: t("agent.voiceDenied") });
      } else if (code === "audio-capture") {
        useAgentStore.setState({ error: t("agent.voiceDenied") });
      } else if (code && code !== "aborted" && code !== "no-speech") {
        useAgentStore.setState({
          error: t("agent.voiceError", { code }),
        });
      }
    };
    rec.onend = () => {
      if (voiceModeRef.current === "webspeech") {
        resetVoiceUi();
      }
    };
    try {
      rec.start();
      setVoicePhase("listening");
      useAgentStore.setState({ error: null });
    } catch {
      resetVoiceUi();
      useAgentStore.setState({ error: t("agent.voiceUnsupported") });
    }
  };

  const startWhisperCapture = async () => {
    if (!apiKey.trim() || !baseUrl.trim()) {
      useAgentStore.setState({
        error: t("agent.voiceNoApiKey"),
        showSettings: true,
      });
      return;
    }
    if (shouldHardBlockNetwork()) {
      useAgentStore.setState({ error: t("agent.voiceOffline") });
      return;
    }
    if (!isWhisperVoiceSupported()) {
      useAgentStore.setState({ error: t("agent.voiceRecorderUnsupported") });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mimeType = pickAudioMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recordChunksRef.current = [];
      voiceModeRef.current = "whisper";
      baseDraftRef.current = draft.trimEnd();

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordChunksRef.current.push(ev.data);
      };

      recorder.onerror = () => {
        resetVoiceUi();
        useAgentStore.setState({ error: t("agent.voiceFailed") });
      };

      recorder.onstop = () => {
        const chunks = recordChunksRef.current;
        const blobType = recorder.mimeType || mimeType || "audio/webm";
        stopMediaTracks();
        mediaRecorderRef.current = null;
        voiceModeRef.current = null;

        void (async () => {
          setVoicePhase("transcribing");
          try {
            if (shouldHardBlockNetwork()) {
              throw new WhisperTranscribeError("offline");
            }
            const blob = new Blob(chunks, { type: blobType });
            const text = await transcribeAudio({
              baseUrl,
              apiKey,
              blob,
              language: whisperLanguage(locale),
            });
            appendTranscript(text);
            useAgentStore.setState({ error: null });
          } catch (e) {
            const code =
              e instanceof WhisperTranscribeError
                ? e.code
                : classifyMediaError(e);
            useAgentStore.setState({ error: voiceErrorMessage(code) });
            if (code === "no_api_key") {
              useAgentStore.setState({ showSettings: true });
            }
          } finally {
            setVoicePhase("idle");
            recordChunksRef.current = [];
          }
        })();
      };

      recorder.start(250);
      setVoicePhase("listening");
      useAgentStore.setState({ error: null });
    } catch (e) {
      resetVoiceUi();
      const code = classifyMediaError(e);
      useAgentStore.setState({ error: voiceErrorMessage(code) });
    }
  };

  const toggleVoice = () => {
    if (transcribing) return;
    if (listening) {
      stopVoice();
      return;
    }

    const mode = resolveVoiceInputMode(Boolean(apiKey.trim()));
    if (!mode) {
      useAgentStore.setState({ error: t("agent.voiceUnsupported") });
      return;
    }
    if (mode === "webspeech" && isSpeechRecognitionSupported()) {
      startWebSpeech();
      return;
    }
    void startWhisperCapture();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-9 shrink-0 items-center justify-between px-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-aether-fg-muted">
          {t("agent.title")}
        </h2>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title={t("agent.clearChatTitle")}
            aria-label={t("agent.clearChat")}
            onClick={clearChat}
            className="flex h-6 w-6 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
          >
            <Eraser size={13} />
          </button>
          <button
            type="button"
            title={t("agent.settingsTitle")}
            aria-label={t("agent.settings")}
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
            <span className="text-[11px] text-aether-fg-dim">
              {t("settings.agent.baseUrl")}
            </span>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="mt-0.5 w-full rounded border border-aether-border bg-aether-bg px-2 py-1 text-aether-fg outline-none focus:border-aether-accent"
              placeholder="https://api.openai.com/v1"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-aether-fg-dim">
              {t("settings.agent.apiKey")}
            </span>
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
            <span className="text-[11px] text-aether-fg-dim">
              {t("settings.agent.model")}
            </span>
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
            {t("settings.agent.attachFile")}
          </label>
          <label className="flex items-center gap-2 text-aether-fg">
            <input
              type="checkbox"
              checked={includeProblems}
              onChange={(e) => setIncludeProblems(e.target.checked)}
            />
            {t("settings.agent.attachProblems")}
          </label>
          <label className="flex items-center gap-2 text-aether-fg">
            <input
              type="checkbox"
              checked={includeBoardHardware}
              onChange={(e) => setIncludeBoardHardware(e.target.checked)}
            />
            {t("settings.agent.attachBoard")}
          </label>
          <p className="text-[11px] leading-relaxed text-aether-fg-dim">
            {t("agent.settingsHint")}
          </p>
        </div>
      )}

      <div
        ref={listRef}
        className="aether-scroll min-h-0 flex-1 space-y-3 overflow-auto px-3 py-2"
      >
        {messages.length === 0 ? (
          <p className="text-xs leading-relaxed text-aether-fg-dim">
            {t("agent.emptyHint")}
          </p>
        ) : (
          messages.map((msg) =>
            msg.role === "user" ? (
              <div
                key={msg.id}
                className="rounded bg-aether-accent-muted px-2 py-1.5 text-xs leading-relaxed whitespace-pre-wrap break-words text-aether-fg"
              >
                <div className="mb-1 text-[10px] uppercase tracking-wide text-aether-fg-dim">
                  {t("agent.roleYou")}
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

      {error && (
        <div
          role="alert"
          className="sticky bottom-0 z-10 flex shrink-0 items-start gap-2 border-t border-aether-danger/40 bg-aether-danger/15 px-3 py-2 text-[12px] leading-snug text-aether-danger"
        >
          <p className="min-w-0 flex-1 break-words font-medium">{error}</p>
          <button
            type="button"
            title={t("agent.errorDismiss")}
            aria-label={t("agent.errorDismiss")}
            onClick={() => useAgentStore.getState().clearError()}
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-aether-danger hover:bg-aether-danger/20"
          >
            <X size={12} />
          </button>
        </div>
      )}
      {!error && applyStatus && (
        <div className="shrink-0 border-t border-aether-border px-3 py-1.5 text-[11px] text-aether-fg-muted">
          {applyStatus}
        </div>
      )}

      <div
        className={cn(
          "shrink-0 border-t border-aether-border p-2",
          dragOver && "bg-aether-accent-muted/40",
        )}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          if (busy) return;
          void onDropFiles(e.dataTransfer.files);
        }}
      >
        {pendingAttachments.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1">
            {pendingAttachments.map((a) => (
              <span
                key={a.id}
                className="inline-flex max-w-full items-center gap-1 rounded border border-aether-border bg-aether-bg px-1.5 py-0.5 text-[10px] text-aether-fg"
                title={a.path ?? a.name}
              >
                <span className="truncate">
                  {a.name}
                  {a.truncated ? "…" : ""}
                </span>
                <button
                  type="button"
                  title={t("agent.removeAttachment")}
                  disabled={busy}
                  onClick={() => removePendingAttachment(a.id)}
                  className="shrink-0 text-aether-fg-muted hover:text-aether-fg disabled:opacity-40"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-1">
          <button
            type="button"
            title={t("agent.attachTitle")}
            aria-label={t("agent.attach")}
            disabled={busy}
            onClick={() => {
              void onAttachClick();
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-aether-border text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg disabled:opacity-40"
          >
            <Paperclip size={14} />
          </button>
          <button
            type="button"
            title={
              transcribing
                ? t("agent.voiceTranscribing")
                : listening
                  ? t("agent.voiceStop")
                  : t("agent.voiceStart")
            }
            aria-label={
              transcribing
                ? t("agent.voiceTranscribing")
                : listening
                  ? t("agent.voiceStop")
                  : t("agent.voiceStart")
            }
            aria-pressed={listening}
            aria-busy={transcribing}
            disabled={busy || transcribing}
            onClick={toggleVoice}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded border border-aether-border text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg disabled:opacity-40",
              listening &&
                "border-aether-danger bg-aether-danger/15 text-aether-danger animate-pulse",
              transcribing &&
                "border-aether-accent bg-aether-accent/15 text-aether-accent animate-pulse",
            )}
          >
            <Mic size={14} />
          </button>
          <textarea
            value={draft}
            rows={3}
            disabled={busy}
            placeholder={
              dragOver ? t("agent.dropHint") : t("agent.placeholder")
            }
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (listening) stopVoice();
                void send();
              }
            }}
            className="aether-scroll min-h-[64px] flex-1 resize-none rounded border border-aether-border bg-aether-bg px-2 py-1.5 text-xs text-aether-fg outline-none focus:border-aether-accent disabled:opacity-50"
          />
          {busy ? (
            <button
              type="button"
              title={t("agent.stopTitle")}
              aria-label={t("agent.stop")}
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
              title={t("agent.sendTitle")}
              aria-label={t("agent.send")}
              disabled={!canSend}
              onClick={() => {
                if (listening) stopVoice();
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
