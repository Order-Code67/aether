import { fetchWithTimeout, TimeoutError } from "@/lib/offline";

/** Default OpenAI Whisper model id for /v1/audio/transcriptions. */
export const DEFAULT_WHISPER_MODEL = "whisper-1";

/** Transcription HTTP timeout (audio upload + inference). */
export const WHISPER_TIMEOUT_MS = 30_000;

export type WhisperTranscribeErrorCode =
  | "no_api_key"
  | "offline"
  | "mic_denied"
  | "unsupported"
  | "empty_audio"
  | "timeout"
  | "failed";

export class WhisperTranscribeError extends Error {
  readonly code: WhisperTranscribeErrorCode;

  constructor(code: WhisperTranscribeErrorCode, message?: string) {
    super(message ?? code);
    this.name = "WhisperTranscribeError";
    this.code = code;
  }
}

/** Join OpenAI-compatible base URL with a path (handles trailing/leading slashes). */
export function joinApiUrl(baseUrl: string, path: string): string {
  const base = baseUrl.trim().replace(/\/+$/, "");
  const segment = path.startsWith("/") ? path : `/${path}`;
  return `${base}${segment}`;
}

export function transcriptionsUrl(baseUrl: string): string {
  return joinApiUrl(baseUrl, "/audio/transcriptions");
}

export function isMediaRecorderSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined"
  );
}

/** Pick a MediaRecorder MIME type the runtime can encode. */
export function pickAudioMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return undefined;
}

export function audioExtensionForMime(mime: string | undefined): string {
  if (!mime) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

/** Build multipart body for Whisper-compatible transcriptions API (testable). */
export function buildTranscriptionFormData(
  file: Blob,
  options: {
    model?: string;
    filename?: string;
    language?: string;
  } = {},
): FormData {
  const model = options.model?.trim() || DEFAULT_WHISPER_MODEL;
  const mime = file.type || "audio/webm";
  const filename =
    options.filename?.trim() ||
    `recording.${audioExtensionForMime(mime)}`;
  const form = new FormData();
  form.append("file", file, filename);
  form.append("model", model);
  if (options.language?.trim()) {
    form.append("language", options.language.trim());
  }
  return form;
}

export type TranscribeAudioOptions = {
  baseUrl: string;
  apiKey: string;
  blob: Blob;
  model?: string;
  language?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

/**
 * POST audio to OpenAI-compatible /audio/transcriptions and return transcript text.
 */
export async function transcribeAudio(
  options: TranscribeAudioOptions,
): Promise<string> {
  const apiKey = options.apiKey.trim();
  if (!apiKey) {
    throw new WhisperTranscribeError("no_api_key");
  }
  if (!options.blob || options.blob.size === 0) {
    throw new WhisperTranscribeError("empty_audio");
  }

  const url = transcriptionsUrl(options.baseUrl);
  const form = buildTranscriptionFormData(options.blob, {
    model: options.model,
    language: options.language,
  });
  const timeoutMs = options.timeoutMs ?? WHISPER_TIMEOUT_MS;

  let res: Response;
  try {
    if (options.fetchImpl) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        res = await options.fetchImpl(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
          signal: controller.signal,
        });
      } catch (error) {
        if (
          error instanceof DOMException &&
          (error.name === "AbortError" || error.name === "TimeoutError")
        ) {
          throw new WhisperTranscribeError("timeout");
        }
        throw new WhisperTranscribeError(
          "failed",
          error instanceof Error ? error.message : undefined,
        );
      } finally {
        clearTimeout(timer);
      }
    } else {
      res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
        },
        timeoutMs,
      );
    }
  } catch (error) {
    if (error instanceof WhisperTranscribeError) throw error;
    if (error instanceof TimeoutError) {
      throw new WhisperTranscribeError("timeout");
    }
    throw new WhisperTranscribeError(
      "failed",
      error instanceof Error ? error.message : undefined,
    );
  }

  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      detail = body.error?.message?.trim() ?? "";
    } catch {
      try {
        detail = (await res.text()).trim().slice(0, 200);
      } catch {
        // ignore
      }
    }
    throw new WhisperTranscribeError(
      "failed",
      detail || `HTTP ${res.status}`,
    );
  }

  const data = (await res.json()) as { text?: string };
  const text = typeof data.text === "string" ? data.text.trim() : "";
  return text;
}

/** Map getUserMedia / MediaRecorder failures to a stable error code. */
export function classifyMediaError(error: unknown): WhisperTranscribeErrorCode {
  if (error instanceof WhisperTranscribeError) return error.code;
  const name =
    error && typeof error === "object" && "name" in error
      ? String((error as { name: unknown }).name)
      : "";
  if (
    name === "NotAllowedError" ||
    name === "PermissionDeniedError" ||
    name === "SecurityError"
  ) {
    return "mic_denied";
  }
  if (
    name === "NotFoundError" ||
    name === "DevicesNotFoundError" ||
    name === "NotReadableError" ||
    name === "TrackStartError"
  ) {
    return "mic_denied";
  }
  if (name === "NotSupportedError" || name === "TypeError") {
    return "unsupported";
  }
  return "failed";
}
