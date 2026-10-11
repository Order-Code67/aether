import { describe, expect, it, vi } from "vitest";
import {
  audioExtensionForMime,
  buildTranscriptionFormData,
  classifyMediaError,
  DEFAULT_WHISPER_MODEL,
  joinApiUrl,
  transcriptionsUrl,
  WhisperTranscribeError,
  transcribeAudio,
} from "./whisperTranscribe";

describe("joinApiUrl", () => {
  it("joins base and path without double slashes", () => {
    expect(joinApiUrl("https://api.openai.com/v1", "/audio/transcriptions")).toBe(
      "https://api.openai.com/v1/audio/transcriptions",
    );
    expect(joinApiUrl("https://api.openai.com/v1/", "audio/transcriptions")).toBe(
      "https://api.openai.com/v1/audio/transcriptions",
    );
    expect(joinApiUrl(" https://proxy.example/v1/ ", "/audio/transcriptions")).toBe(
      "https://proxy.example/v1/audio/transcriptions",
    );
  });
});

describe("transcriptionsUrl", () => {
  it("appends /audio/transcriptions to the agent base URL", () => {
    expect(transcriptionsUrl("https://api.openai.com/v1")).toBe(
      "https://api.openai.com/v1/audio/transcriptions",
    );
  });
});

describe("audioExtensionForMime", () => {
  it("maps common mime types", () => {
    expect(audioExtensionForMime("audio/webm;codecs=opus")).toBe("webm");
    expect(audioExtensionForMime("audio/ogg")).toBe("ogg");
    expect(audioExtensionForMime("audio/mp4")).toBe("m4a");
    expect(audioExtensionForMime(undefined)).toBe("webm");
  });
});

describe("buildTranscriptionFormData", () => {
  it("appends file + model (default whisper-1)", () => {
    const blob = new Blob(["fake"], { type: "audio/webm" });
    const form = buildTranscriptionFormData(blob);
    expect(form.get("model")).toBe(DEFAULT_WHISPER_MODEL);
    const file = form.get("file");
    expect(file).toBeInstanceOf(File);
    expect((file as File).name).toBe("recording.webm");
  });

  it("honors model, filename, and language", () => {
    const blob = new Blob(["fake"], { type: "audio/ogg" });
    const form = buildTranscriptionFormData(blob, {
      model: "whisper-1",
      filename: "clip.ogg",
      language: "ru",
    });
    expect(form.get("model")).toBe("whisper-1");
    expect(form.get("language")).toBe("ru");
    expect((form.get("file") as File).name).toBe("clip.ogg");
  });
});

describe("classifyMediaError", () => {
  it("maps permission and device errors", () => {
    expect(classifyMediaError(Object.assign(new Error(), { name: "NotAllowedError" }))).toBe(
      "mic_denied",
    );
    expect(classifyMediaError(Object.assign(new Error(), { name: "NotFoundError" }))).toBe(
      "mic_denied",
    );
    expect(classifyMediaError(Object.assign(new Error(), { name: "NotSupportedError" }))).toBe(
      "unsupported",
    );
    expect(classifyMediaError(new WhisperTranscribeError("offline"))).toBe("offline");
  });
});

describe("transcribeAudio", () => {
  it("rejects without API key", async () => {
    await expect(
      transcribeAudio({
        baseUrl: "https://api.openai.com/v1",
        apiKey: "  ",
        blob: new Blob(["x"], { type: "audio/webm" }),
      }),
    ).rejects.toMatchObject({ code: "no_api_key" });
  });

  it("rejects empty audio", async () => {
    await expect(
      transcribeAudio({
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-test",
        blob: new Blob([], { type: "audio/webm" }),
      }),
    ).rejects.toMatchObject({ code: "empty_audio" });
  });

  it("POSTs multipart and returns text", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ text: " hello " }), { status: 200 }),
    );
    const text = await transcribeAudio({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test",
      blob: new Blob(["x"], { type: "audio/webm" }),
      fetchImpl,
    });
    expect(text).toBe("hello");
    expect(fetchImpl).toHaveBeenCalledOnce();
    const call = fetchImpl.mock.calls[0];
    expect(call).toBeDefined();
    const url = call![0];
    const init = call![1] as RequestInit;
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer sk-test",
    });
    expect(init.body).toBeInstanceOf(FormData);
  });
});
