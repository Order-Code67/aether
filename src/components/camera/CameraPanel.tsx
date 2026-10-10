import { useEffect } from "react";
import { Camera, RefreshCw, Unplug } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import { useCameraStore } from "@/stores/cameraStore";

export function CameraPanel() {
  const { t } = useI18n();
  const url = useCameraStore((s) => s.url);
  const displaySrc = useCameraStore((s) => s.displaySrc);
  const status = useCameraStore((s) => s.status);
  const error = useCameraStore((s) => s.error);
  const refreshMs = useCameraStore((s) => s.refreshMs);
  const setUrl = useCameraStore((s) => s.setUrl);
  const setRefreshMs = useCameraStore((s) => s.setRefreshMs);
  const connect = useCameraStore((s) => s.connect);
  const refresh = useCameraStore((s) => s.refresh);
  const disconnect = useCameraStore((s) => s.disconnect);
  const setError = useCameraStore((s) => s.setError);
  const setLive = useCameraStore((s) => s.setLive);

  useEffect(() => {
    if (refreshMs <= 0 || status === "idle") return;
    const id = window.setInterval(() => refresh(), refreshMs);
    return () => window.clearInterval(id);
  }, [refreshMs, status, refresh]);

  const statusLabel =
    status === "live"
      ? t("camera.status.live")
      : status === "loading"
        ? t("camera.status.loading")
        : status === "error"
          ? t("camera.status.error")
          : t("camera.status.idle");

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
        <span
          className={cn(
            "ml-auto text-[11px]",
            status === "error"
              ? "text-aether-danger"
              : status === "live"
                ? "text-aether-accent"
                : "text-aether-fg-dim",
          )}
        >
          {statusLabel}
        </span>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black/40">
        {displaySrc ? (
          <img
            key={displaySrc}
            src={displaySrc}
            alt={t("camera.previewAlt")}
            className="max-h-full max-w-full object-contain"
            onLoad={() => setLive()}
            onError={() => setError("load_failed")}
          />
        ) : (
          <p className="max-w-md px-4 text-center text-[11px] text-aether-fg-muted">
            {t("camera.hint")}
          </p>
        )}
        {status === "error" && (
          <p className="absolute bottom-2 left-2 right-2 rounded bg-aether-danger/20 px-2 py-1 text-center text-[11px] text-aether-danger">
            {error === "empty" ? t("camera.errorEmpty") : t("camera.errorLoad")}
          </p>
        )}
      </div>
    </div>
  );
}
