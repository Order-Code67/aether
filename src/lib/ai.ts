import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isTauriRuntime } from "@/lib/tauri";

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiChunkPayload {
  text: string;
}

export interface AiStatusPayload {
  running: boolean;
  cancelled: boolean;
  error: string | null;
}

export async function chatCompletion(options: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: AiMessage[];
}): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error("AI Agent requires the desktop app (npm run tauri:dev).");
  }
  return invoke<string>("ai_chat_completion", {
    request: {
      baseUrl: options.baseUrl,
      apiKey: options.apiKey,
      model: options.model,
      messages: options.messages,
    },
  });
}

export async function chatStream(options: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: AiMessage[];
}): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error("AI Agent requires the desktop app (npm run tauri:dev).");
  }
  await invoke("ai_chat_stream", {
    request: {
      baseUrl: options.baseUrl,
      apiKey: options.apiKey,
      model: options.model,
      messages: options.messages,
    },
  });
}

export async function cancelChatStream(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("ai_cancel");
}

export async function listenAiChunk(
  handler: (payload: AiChunkPayload) => void,
): Promise<UnlistenFn> {
  return listen<AiChunkPayload>("ai-chunk", (event) => {
    handler(event.payload);
  });
}

export async function listenAiStatus(
  handler: (payload: AiStatusPayload) => void,
): Promise<UnlistenFn> {
  return listen<AiStatusPayload>("ai-status", (event) => {
    handler(event.payload);
  });
}
