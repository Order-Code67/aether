import { useEffect, useRef, useState } from "react";
import {
  createRecorder,
  listCaptureDevices,
  openCaptureStream,
  stopStream,
} from "@/services/video";
import type { CaptureDeviceInfo, VideoSignalState } from "@/types";
import { eventBus } from "@/services/events/eventBus";
import { useArchiveStore } from "@/stores/archiveStore";

export function VideoPanel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
      // Permission probe so labels become available
      if (navigator.mediaDevices?.getUserMedia) {
        const tmp = await navigator.mediaDevices.getUserMedia({ video: true });
        tmp.getTracks().forEach((t) => t.stop());
      }
      const list = await listCaptureDevices();
      setDevices(list);
      if (!selected && list[0]) setSelected(list[0].deviceId);
      if (list.length === 0) {
        setSignal("no-device");
        setError("Устройства захвата не найдены");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка доступа к камере");
      setSignal("no-device");
    }
  };

  const connect = async (deviceId: string) => {
    stopStream(streamRef.current);
    streamRef.current = null;
    setError(null);
    setSignal("unknown");
    try {
      const stream = await openCaptureStream(deviceId || undefined);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setSignal("ok");
      eventBus.emit("info", "video", "Видеозахват подключён");
    } catch (e) {
      setSignal("no-device");
      setError(e instanceof Error ? e.message : "Нет сигнала");
    }
  };

  useEffect(() => {
    void refreshDevices();
    return () => {
      recorderRef.current?.stop();
      stopStream(streamRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const toggleRecord = () => {
    const stream = streamRef.current;
    if (!stream) return;
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    chunksRef.current = [];
    const rec = createRecorder(stream, (blob) => chunksRef.current.push(blob));
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      addClip({
        id: `clip_${Date.now().toString(36)}`,
        title: `Запись ${new Date().toLocaleString()}`,
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        source: selected || "capture",
        sizeBytes: blob.size,
        objectUrl: url,
        mimeType: blob.type,
      });
      eventBus.emit("info", "archive", `Сохранена запись ${(blob.size / 1024).toFixed(0)} КБ`);
    };
    recorderRef.current = rec;
    rec.start(1000);
    setRecording(true);
  };

  const enterFullscreen = () => {
    void videoRef.current?.requestFullscreen?.();
  };

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => void refreshDevices()}
          className="rounded border border-ags-border px-2 py-1 text-ags-muted hover:text-ags-fg"
        >
          Обновить устройства
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
        <button
          type="button"
          disabled={!selected}
          onClick={() => void connect(selected)}
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
          {recording ? "Стоп записи" : "Запись"}
        </button>
        <button
          type="button"
          onClick={enterFullscreen}
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
            {error ?? "Нет видеопотока. Подключите устройство захвата."}
          </div>
        )}
      </div>

      <div className="flex gap-4 font-mono text-[11px] text-ags-muted">
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
