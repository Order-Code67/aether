import { useEffect, useRef } from "react";
import {
  Camera,
  Circle,
  ImageDown,
  RefreshCw,
  Unplug,
} from "lucide-react";
import { OpticalNavBar } from "@/components/camera/OpticalNavBar";
import { OpticalNavCompass } from "@/components/camera/OpticalNavCompass";
import { useI18n } from "@/hooks/useI18n";
import {
  recordCameraSeriesToFolder,
  saveCameraFrameToDisk,
} from "@/lib/cameraCapture";
import { looksLikeEsp32Cam } from "@/lib/cameraIp";
import { cn } from "@/lib/cn";
import { isTauriRuntime } from "@/lib/tauri";
import { useCameraStore } from "@/stores/cameraStore";
import { useFirmwareProfileStore } from "@/stores/firmwareProfileStore";
import { useOpticalNavStore } from "@/stores/opticalNavStore";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useSettingsStore } from "@/stores/settingsStore";

const ESP32_CAM_README_URL =
  "https://github.com/Order-Code67/aether/blob/main/src-tauri/resources/examples/esp32-cam/README.md";

export function CameraPanel() {
  const { t, locale } = useI18n();
  const url = useCameraStore((s) => s.url);
  const displaySrc = useCameraStore((s) => s.displaySrc);
  const lastGoodSrc = useCameraStore((s) => s.lastGoodSrc);
  const status = useCameraStore((s) => s.status);
  const error = useCameraStore((s) => s.error);
  const refreshMs = useCameraStore((s) => s.refreshMs);
  const keepLastFrame = useCameraStore((s) => s.keepLastFrame);
  const recording = useCameraStore((s) => s.recording);
  const recordProgress = useCameraStore((s) => s.recordProgress);
  const setUrl = useCameraStore((s) => s.setUrl);
  const setRefreshMs = useCameraStore((s) => s.setRefreshMs);
  const setKeepLastFrame = useCameraStore((s) => s.setKeepLastFrame);
  const connect = useCameraStore((s) => s.connect);
  const refresh = useCameraStore((s) => s.refresh);
  const disconnect = useCameraStore((s) => s.disconnect);
  const setError = useCameraStore((s) => s.setError);
  const setLive = useCameraStore((s) => s.setLive);
  const setRecording = useCameraStore((s) => s.setRecording);
  const setRecordProgress = useCameraStore((s) => s.setRecordProgress);
  const flashNotice = useSettingsStore((s) => s.flashNotice);
  const selectedEnv = usePlatformIoStore((s) => s.selectedEnv);
  const profiles = useFirmwareProfileStore((s) => s.profiles);
  const opticalNavEnabled = useOpticalNavStore((s) => s.enabled);
  const processFrameUrl = useOpticalNavStore((s) => s.processFrameUrl);
  const abortRef = useRef(false);

  const activeProfile = profiles.find(
    (p) => p.env && selectedEnv && p.env === selectedEnv,
  );
  const showPowerHint = looksLikeEsp32Cam(url, {
    env: selectedEnv,
    profileName: activeProfile?.name,
  });

  useEffect(() => {
    if (refreshMs <= 0 || status === "idle" || recording) return;
    // Keep polling during reconnect/error so Wi‑Fi recovery is automatic
    const id = window.setInterval(() => refresh(), refreshMs);
    return () => window.clearInterval(id);
  }, [refreshMs, status, refresh, recording]);

  // Optical nav: each new live frame URL → optical flow + dead reckoning
  useEffect(() => {
    if (!opticalNavEnabled || status !== "live" || !displaySrc) return;
    void processFrameUrl(displaySrc);
  }, [opticalNavEnabled, status, displaySrc, processFrameUrl]);

  // While reconnecting / after error, prefer last good frame so UI does not flash blank.
  const shownSrc =
    keepLastFrame &&
    lastGoodSrc &&
    (status === "error" || status === "reconnecting")
      ? lastGoodSrc
      : displaySrc || lastGoodSrc;

  const statusLabel =
    status === "live"
      ? t("camera.status.live")
      : status === "loading"
        ? t("camera.status.loading")
        : status === "reconnecting"
          ? t("camera.status.reconnecting")
          : status === "error"
            ? t("camera.status.error")
            : t("camera.status.idle");

  const saveFrame = async () => {
    if (!isTauriRuntime()) {
      flashNotice(t("camera.desktopOnly"));
      return;
    }
    const src = displaySrc || lastGoodSrc;
    if (!src) {
      flashNotice(t("camera.saveNoFrame"));
      return;
    }
    try {
      const path = await saveCameraFrameToDisk(src, locale);
      if (path) flashNotice(t("camera.savedFrame"), 3000);
    } catch (e) {
      flashNotice(e instanceof Error ? e.message : t("camera.saveFailed"));
    }
  };

  const toggleRecord = async () => {
    if (recording) {
      abortRef.current = true;
      setRecording(false);
      return;
    }
    if (!isTauriRuntime()) {
      flashNotice(t("camera.desktopOnly"));
      return;
    }
    const raw = window.prompt(t("camera.recordPrompt"), "10");
    if (!raw) return;
    const frameCount = Math.max(1, Math.min(500, Number(raw) || 10));
    const intervalRaw = window.prompt(t("camera.recordIntervalPrompt"), "1000");
    if (intervalRaw == null) return;
    const intervalMs = Math.max(0, Number(intervalRaw) || 1000);

    abortRef.current = false;
    setRecording(true);
    setRecordProgress({ done: 0, total: frameCount });
    try {
      const result = await recordCameraSeriesToFolder({
        getNextUrl: () => {
          // Bust cache each frame
          useCameraStore.getState().refresh();
          return useCameraStore.getState().displaySrc || url;
        },
        frameCount,
        intervalMs,
        locale,
        onProgress: (done, total) => setRecordProgress({ done, total }),
        shouldAbort: () => abortRef.current,
      });
      if (result) {
        flashNotice(
          t("camera.recorded", {
            count: result.saved,
            folder: result.folder,
          }),
          4000,
        );
      }
    } catch (e) {
      flashNotice(e instanceof Error ? e.message : t("camera.recordFailed"));
    } finally {
      setRecording(false);
      setRecordProgress(null);
      abortRef.current = false;
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-aether-border px-2 py-1.5">
        <Camera size={13} className="text-aether-fg-muted" />
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t("camera.urlPlaceholder")}
          aria-label={t("camera.url")}
          className="h-7 min-w-[200px] flex-1 rounded border border-aether-border bg-aether-bg px-2 font-mono text-[11px] text-aether-fg outline-none focus:border-aether-accent"
        />
        <button
          type="button"
          onClick={connect}
          className="flex h-7 items-center gap-1 rounded border border-aether-border px-2 text-[11px] text-aether-fg hover:bg-aether-surface-raised"
        >
          {t("camera.connect")}
        </button>
        <button
          type="button"
          onClick={refresh}
          title={t("camera.refresh")}
          aria-label={t("camera.refresh")}
          className="flex h-7 w-7 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
        >
          <RefreshCw size={13} />
        </button>
        <button
          type="button"
          onClick={() => void saveFrame()}
          title={t("camera.saveFrame")}
          aria-label={t("camera.saveFrame")}
          className="flex h-7 items-center gap-1 rounded border border-aether-border px-2 text-[11px] text-aether-fg hover:bg-aether-surface-raised"
        >
          <ImageDown size={13} />
          {t("camera.saveFrame")}
        </button>
        <button
          type="button"
          onClick={() => void toggleRecord()}
          title={recording ? t("camera.recordStop") : t("camera.record")}
          aria-label={recording ? t("camera.recordStop") : t("camera.record")}
          className={cn(
            "flex h-7 items-center gap-1 rounded border px-2 text-[11px]",
            recording
              ? "border-aether-danger text-aether-danger"
              : "border-aether-border text-aether-fg hover:bg-aether-surface-raised",
          )}
        >
          <Circle
            size={11}
            className={recording ? "fill-aether-danger" : ""}
          />
          {recording
            ? recordProgress
              ? `${t("camera.recordStop")} ${recordProgress.done}/${recordProgress.total}`
              : t("camera.recordStop")
            : t("camera.record")}
        </button>
        <button
          type="button"
          onClick={disconnect}
          title={t("camera.disconnect")}
          aria-label={t("camera.disconnect")}
          className="flex h-7 w-7 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
        >
          <Unplug size={13} />
        </button>
        <label className="ml-1 flex items-center gap-1 text-[11px] text-aether-fg-dim">
          {t("camera.autoRefresh")}
          <select
            value={refreshMs}
            onChange={(e) => setRefreshMs(Number(e.target.value))}
            className="h-7 rounded border border-aether-border bg-aether-bg px-1 text-[11px] text-aether-fg"
          >
            <option value={0}>{t("camera.autoOff")}</option>
            <option value={1000}>1s</option>
            <option value={2000}>2s</option>
            <option value={5000}>5s</option>
          </select>
        </label>
        <label className="flex items-center gap-1 text-[11px] text-aether-fg-dim">
          <input
            type="checkbox"
            checked={keepLastFrame}
            onChange={(e) => setKeepLastFrame(e.target.checked)}
          />
          {t("camera.keepLastFrame")}
        </label>
        <span
          className={cn(
            "ml-auto text-[11px]",
            status === "error"
              ? "text-aether-danger"
              : status === "reconnecting"
                ? "text-aether-fg-muted"
                : status === "live"
                  ? "text-aether-accent"
                  : "text-aether-fg-dim",
          )}
        >
          {statusLabel}
        </span>
      </div>

      {showPowerHint && (
        <div
          className="flex flex-wrap items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-100/90"
          role="note"
        >
          <span className="min-w-0 flex-1">{t("camera.powerHint")}</span>
          <button
            type="button"
            className="shrink-0 underline decoration-amber-400/60 underline-offset-2 hover:text-amber-50"
            onClick={() => {
              void import("@tauri-apps/plugin-opener").then(({ openUrl }) =>
                openUrl(ESP32_CAM_README_URL),
              );
            }}
          >
            {t("camera.powerHintDocs")}
          </button>
        </div>
      )}

      <OpticalNavBar />

      <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black/40">
        {shownSrc || displaySrc ? (
          <>
            {/* Hidden probe loads the next URL; visible img keeps last good frame */}
            {displaySrc && status !== "idle" && status !== "error" && (
              <img
                key={displaySrc}
                src={displaySrc}
                alt=""
                className="pointer-events-none absolute h-0 w-0 opacity-0"
                onLoad={() => setLive()}
                onError={() => setError("load_failed")}
              />
            )}
            {(status === "live" && displaySrc ? displaySrc : shownSrc) && (
              <img
                src={
                  status === "live" && displaySrc ? displaySrc : shownSrc
                }
                alt={t("camera.previewAlt")}
                className="max-h-full max-w-full object-contain"
              />
            )}
          </>
        ) : (
          <p className="max-w-md px-4 text-center text-[11px] text-aether-fg-muted">
            {t("camera.hint")}
          </p>
        )}
        <OpticalNavCompass />
        {(status === "error" || status === "reconnecting") && (
          <p className="absolute bottom-2 left-2 right-2 rounded bg-aether-danger/20 px-2 py-1 text-center text-[11px] text-aether-danger">
            {status === "reconnecting"
              ? t("camera.status.reconnecting")
              : error === "empty"
                ? t("camera.errorEmpty")
                : t("camera.errorLoad")}
          </p>
        )}
      </div>
    </div>
  );
}
