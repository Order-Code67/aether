import type { CaptureDeviceInfo, VideoMetrics, VideoSignalState } from "@/types";
import { eventBus } from "@/services/events/eventBus";

/** Video Capture Service — реальные устройства через MediaDevices (WebView2). */
export async function listCaptureDevices(): Promise<CaptureDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return [];
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === "videoinput")
    .map((d) => ({
      deviceId: d.deviceId,
      label: d.label || `Камера ${d.deviceId.slice(0, 8)}`,
    }));
}

export async function openCaptureStream(
  deviceId?: string,
): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Видеозахват недоступен в этой среде");
  }
  const constraints: MediaStreamConstraints = {
    audio: false,
    video: deviceId
      ? { deviceId: { exact: deviceId } }
      : { width: { ideal: 1920 }, height: { ideal: 1080 } },
  };
  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Не удалось открыть устройство захвата";
    eventBus.emit("error", "video-capture", message);
    throw new Error(message);
  }
}

export function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}

export function readVideoMetrics(
  video: HTMLVideoElement | null,
  signal: VideoSignalState,
  error?: string,
): VideoMetrics {
  if (!video || video.videoWidth <= 0) {
    return { signal: error ? "no-device" : signal, error };
  }
  return {
    width: video.videoWidth,
    height: video.videoHeight,
    signal,
    error,
  };
}

export function createRecorder(
  stream: MediaStream,
  onData: (blob: Blob) => void,
): MediaRecorder {
  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType: mime });
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) onData(e.data);
  };
  return recorder;
}
