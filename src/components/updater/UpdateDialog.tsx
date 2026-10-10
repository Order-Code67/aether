import { X } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { localizeUpdateNotes } from "@/lib/updateNotes";
import { isTauriRuntime } from "@/lib/tauri";
import { useUpdaterStore } from "@/stores/updaterStore";

export function UpdateDialog() {
  const { t, locale } = useI18n();
  const dialogOpen = useUpdaterStore((s) => s.dialogOpen);
  const phase = useUpdaterStore((s) => s.phase);
  const availableVersion = useUpdaterStore((s) => s.availableVersion);
  const notes = useUpdaterStore((s) => s.notes);
  const progress = useUpdaterStore((s) => s.progress);
  const error = useUpdaterStore((s) => s.error);
  const closeDialog = useUpdaterStore((s) => s.closeDialog);
  const installAndRelaunch = useUpdaterStore((s) => s.installAndRelaunch);

  if (!dialogOpen || !isTauriRuntime()) return null;
  if (phase !== "available" && phase !== "downloading" && phase !== "error") {
    return null;
  }

  const displayNotes = localizeUpdateNotes(availableVersion, notes, locale);
  const busy = phase === "downloading";
  const pct =
    progress?.contentLength && progress.contentLength > 0
      ? Math.min(
          100,
          Math.round((progress.downloaded / progress.contentLength) * 100),
        )
      : null;

  return (
    <div
      className="absolute inset-0 z-[60] flex items-start justify-center bg-black/50 px-4 pt-[18vh]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) closeDialog();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("updater.title")}
        data-aether-focus-surface="dialog"
        className="w-full max-w-md overflow-hidden rounded border border-aether-border bg-aether-surface shadow-2xl"
      >
        <header className="flex h-10 items-center justify-between border-b border-aether-border px-3">
          <h2 className="text-sm font-medium text-aether-fg">
            {t("updater.title")}
          </h2>
          <button
            type="button"
            title={t("updater.later")}
            aria-label={t("updater.later")}
            disabled={busy}
            onClick={closeDialog}
            className="flex h-7 w-7 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </header>

        <div className="space-y-3 p-4 text-xs text-aether-fg">
          <p className="text-aether-fg-muted">
            {t("updater.available", { version: availableVersion ?? "?" })}
          </p>
          <div className="max-h-40 overflow-auto whitespace-pre-wrap rounded border border-aether-border bg-aether-bg/60 p-2 text-[11px] leading-relaxed text-aether-fg-muted">
            {displayNotes}
          </div>
          {phase === "downloading" && (
            <div className="space-y-1">
              <p className="text-[11px] text-aether-fg-dim">
                {pct != null
                  ? t("updater.downloadingPct", { pct })
                  : t("updater.downloading")}
              </p>
              {pct != null && (
                <div className="h-1.5 overflow-hidden rounded bg-aether-surface-raised">
                  <div
                    className="h-full bg-aether-accent transition-[width]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          )}
          {phase === "error" && error && (
            <p className="text-[11px] text-aether-danger">{error}</p>
          )}
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={closeDialog}
              className="rounded border border-aether-border px-2.5 py-1.5 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
            >
              {t("updater.later")}
            </button>
            <button
              type="button"
              disabled={busy || phase === "error"}
              onClick={() => void installAndRelaunch()}
              className="rounded bg-aether-accent px-2.5 py-1.5 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              {busy ? t("updater.downloading") : t("updater.install")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
