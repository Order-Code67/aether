import { useEffect, useRef, useState } from "react";
import {
  createRecorder,
  stopStream,
} from "@/services/video";
import {
  getVideoAdapter,
  type VideoAdapterKind,
} from "@/services/video/adapters";
import { saveRecordingToDisk } from "@/services/video/recording";
import type { CaptureDeviceInfo, VideoSignalState } from "@/types";
import { eventBus } from "@/services/events/eventBus";
import { useArchiveStore } from "@/stores/archiveStore";
import { deviceManager } from "@/services/devices/deviceManager";

export function VideoPanel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<string>("");

  const [adapterKind, setAdapterKind] =
    useState<VideoAdapterKind>("mediadevices");
  const [sourceUrl, setSourceUrl] = useState("");
  const [devices, setDevices] = useState<CaptureDeviceInfo[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [signal, setSignal] = useState<VideoSignalState>("no-device");
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState<number | undefined>();
  const [size, setSize] = useState<{ w?: number; h?: number }>({});
  const [recording, setRecording] = useState(false);
  const addClip = useArchiveStore((s) => s.addClip);

  const refreshDevices = async () => {
    try {
      if (
        adapterKind === "mediadevices" &&
        navigator.mediaDevices?.getUserMedia
      ) {
        const tmp = await navigator.mediaDevices.getUserMedia({ video: true });
        tmp.getTracks().forEach((t) => t.stop());
      }
      const adapter = getVideoAdapter(adapterKind);
      const list = await adapter.listSources();
      setDevices(list);
      if (!selected && list[0]) setSelected(list[0].deviceId);
      if (adapterKind === "mediadevices" && list.length === 0) {
        setSignal("no-device");
        setError("Нет устройства захвата");
      } else {
        setError(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка доступа к камере");
      setSignal("no-device");
    }
  };

  const connect = async () => {
    stopStream(streamRef.current);
    streamRef.current = null;
    setError(null);
    setSignal("unknown");
    const adapter = getVideoAdapter(adapterKind);
    const sourceId =
      adapterKind === "mediadevices" ? selected : sourceUrl.trim();
    const cardId = `video:${adapterKind}:${sourceId || "default"}`;
    try {
      const stream = await adapter.open(sourceId);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setSignal("ok");
      deviceManager.upsert({
        id: cardId,
        name: adapter.label,
        connectionType: "capture",
        address: sourceId || undefined,
        status: "Online",
        lastSeenAt: new Date().toISOString(),
        capabilities: ["video"],
      });
      deviceManager.registerReconnectHandler(cardId, async () => {
        const s = await adapter.open(sourceId);
        stopStream(streamRef.current);
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play();
        }
      });
      eventBus.emit("info", "video", `Видео: ${adapter.label}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Нет сигнала";
      setSignal(
        msg.toLowerCase().includes("нет устройства") ||
          msg.toLowerCase().includes("not found")
          ? "no-device"
          : "lost",
      );
      setError(msg);
      deviceManager.upsert({
        id: cardId,
        name: adapter.label,
        connectionType: "capture",
        address: sourceId || undefined,
        status: "Lost",
        lastSeenAt: new Date().toISOString(),
        capabilities: ["video"],
      });
    }
  };

  useEffect(() => {
    void refreshDevices();
    return () => {
      recorderRef.current?.stop();
      stopStream(streamRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapterKind]);

  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v && v.videoWidth > 0) {
        frames += 1;
        setSize({ w: v.videoWidth, h: v.videoHeight });
        const now = performance.now();
        if (now - last >= 1000) {
          setFps(frames);
          frames = 0;
          last = now;
        }
      } else if (signal === "ok") {
        setSignal("lost");
        setError("Нет сигнала");
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [signal]);

  const toggleRecord = () => {
    const stream = streamRef.current;
    if (!stream) return;
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    chunksRef.current = [];
    startedAtRef.current = new Date().toISOString();
    const rec = createRecorder(stream, (blob) => chunksRef.current.push(blob));
    rec.onstop = () => {
      void (async () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const saved = await saveRecordingToDisk(
          blob,
          selected || sourceUrl || "capture",
        );
        const url = URL.createObjectURL(blob);
        addClip({
          id: saved?.id ?? `clip_${Date.now().toString(36)}`,
          title: `Запись ${new Date().toLocaleString()}`,
          startedAt: startedAtRef.current,
          endedAt: new Date().toISOString(),
          source: selected || sourceUrl || "capture",
          sizeBytes: blob.size,
          objectUrl: url,
          mimeType: blob.type,
          filePath: saved?.path,
        });
      })();
    };
    recorderRef.current = rec;
    rec.start(1000);
    setRecording(true);
  };

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select
          className="rounded border border-ags-border bg-ags-elevated px-2 py-1 text-ags-fg"
          value={adapterKind}
          onChange={(e) =>
            setAdapterKind(e.target.value as VideoAdapterKind)
          }
        >
          <option value="mediadevices">UVC / HDMI</option>
          <option value="rtsp">RTSP</option>
          <option value="webrtc">WebRTC</option>
        </select>
        {adapterKind === "mediadevices" ? (
          <>
            <button
              type="button"
              onClick={() => void refreshDevices()}
              className="rounded border border-ags-border px-2 py-1 text-ags-muted hover:text-ags-fg"
            >
              Обновить
            </button>
            <select
              className="min-w-[12rem] flex-1 rounded border border-ags-border bg-ags-elevated px-2 py-1 text-ags-fg"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {devices.length === 0 && <option value="">Нет устройств</option>}
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
          </>
        ) : (
          <input
            className="min-w-[16rem] flex-1 rounded border border-ags-border bg-ags-elevated px-2 py-1 text-ags-fg"
            placeholder={
              adapterKind === "rtsp"
                ? "rtsp://host:554/stream"
                : "wss://signaling…"
            }
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
          />
        )}
        <button
          type="button"
          disabled={adapterKind === "mediadevices" ? !selected : !sourceUrl}
          onClick={() => void connect()}
          className="rounded bg-ags-accent px-2 py-1 text-white disabled:opacity-40"
        >
          Подключить
        </button>
        <button
          type="button"
          disabled={signal !== "ok"}
          onClick={toggleRecord}
          className="rounded border border-ags-border px-2 py-1 disabled:opacity-40"
        >
          {recording ? "Стоп → диск" : "Запись на диск"}
        </button>
        <button
          type="button"
          onClick={() => void videoRef.current?.requestFullscreen?.()}
          className="rounded border border-ags-border px-2 py-1"
        >
          Полный экран
        </button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded border border-ags-border bg-black">
        <video
          ref={videoRef}
          className="h-full w-full object-contain"
          muted
          playsInline
        />
        {signal !== "ok" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4 text-center text-sm text-ags-muted">
            {error ??
              (signal === "no-device"
                ? "Нет устройства"
                : signal === "lost"
                  ? "Нет сигнала"
                  : "Нет видеопотока")}
          </div>
        )}
      </div>

      <div className="flex gap-4 font-mono text-[11px] text-ags-muted">
        <span>Адаптер: {adapterKind}</span>
        <span>Сигнал: {signal}</span>
        <span>FPS: {fps ?? "—"}</span>
        <span>
          Разрешение:{" "}
          {size.w && size.h ? `${size.w}×${size.h}` : "—"}
        </span>
      </div>
    </div>
  );
}
