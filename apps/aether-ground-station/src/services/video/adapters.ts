import type { CaptureDeviceInfo } from "@/types";
import { eventBus } from "@/services/events/eventBus";
import { listCaptureDevices, openCaptureStream } from "./captureService";

export type VideoAdapterKind = "mediadevices" | "rtsp" | "webrtc";

export interface VideoAdapter {
  kind: VideoAdapterKind;
  label: string;
  listSources(): Promise<CaptureDeviceInfo[]>;
  open(sourceId: string): Promise<MediaStream>;
}

/** UVC / HDMI capture via WebView2 MediaDevices (current). Rust/FFmpeg service — next. */
export const mediaDevicesAdapter: VideoAdapter = {
  kind: "mediadevices",
  label: "UVC / HDMI (MediaDevices)",
  listSources: listCaptureDevices,
  open: (id) => openCaptureStream(id || undefined),
};

/**
 * RTSP adapter — URL as source id. Browser MediaStream from RTSP requires
 * native Video Capture Service; until then we surface a clear error.
 */
export const rtspAdapter: VideoAdapter = {
  kind: "rtsp",
  label: "RTSP",
  async listSources() {
    return [];
  },
  async open(url: string) {
    if (!url.trim()) throw new Error("Укажите RTSP URL");
    eventBus.emit(
      "warning",
      "video-rtsp",
      "RTSP требует Video Capture Service (Rust/FFmpeg). Поток не открыт.",
    );
    throw new Error(
      "RTSP: нативный захват ещё не подключён. Используйте UVC/HDMI или дождитесь Video Capture Service.",
    );
  },
};

/** WebRTC adapter — separate from MediaDevices; needs signaling endpoint. */
export const webrtcAdapter: VideoAdapter = {
  kind: "webrtc",
  label: "WebRTC",
  async listSources() {
    return [];
  },
  async open(signalingUrl: string) {
    if (!signalingUrl.trim()) throw new Error("Укажите signaling URL");
    eventBus.emit(
      "warning",
      "video-webrtc",
      "WebRTC-адаптер ожидает signaling endpoint Remote/Video Relay.",
    );
    throw new Error(
      "WebRTC: нет signaling endpoint. Настройте Remote Gateway или локальный relay.",
    );
  },
};

export function getVideoAdapter(kind: VideoAdapterKind): VideoAdapter {
  switch (kind) {
    case "rtsp":
      return rtspAdapter;
    case "webrtc":
      return webrtcAdapter;
    default:
      return mediaDevicesAdapter;
  }
}
