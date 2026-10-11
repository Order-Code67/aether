import type { Locale } from "@/i18n";
import { isMediaRecorderSupported } from "@/lib/whisperTranscribe";

export type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function speechLocale(locale: Locale): string {
  return locale === "ru" ? "ru-RU" : "en-US";
}

/** ISO-639-1 hint for Whisper `language` field. */
export function whisperLanguage(locale: Locale): string {
  return locale === "ru" ? "ru" : "en";
}

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Optional fast path — often missing in WebView2. */
export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

/** Reliable path: mic capture for Whisper-compatible API. */
export function isWhisperVoiceSupported(): boolean {
  return isMediaRecorderSupported();
}

export type VoiceInputMode = "webspeech" | "whisper";

/**
 * Prefer Web Speech when the constructor exists; otherwise MediaRecorder+API.
 * Returns null when neither capture path is available.
 */
export function resolveVoiceInputMode(_hasApiKey?: boolean): VoiceInputMode | null {
  if (isSpeechRecognitionSupported()) return "webspeech";
  if (isWhisperVoiceSupported()) return "whisper";
  return null;
}

export function createSpeechRecognition(
  locale: Locale,
): SpeechRecognitionLike | null {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = speechLocale(locale);
  rec.continuous = true;
  rec.interimResults = true;
  return rec;
}
