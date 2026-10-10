import { useEffect, useState } from "react";
import { BookOpen, ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  listBundledExamples,
  localizeExample,
  materializeBundledExample,
  type BundledExample,
} from "@/lib/examples";
import { isTauriRuntime } from "@/lib/tauri";
import { useI18n } from "@/hooks/useI18n";
import { useWorkspaceStore } from "@/stores/workspaceStore";

const WIFI_DOCS =
  "https://docs.platformio.org/en/latest/platforms/espressif32.html";

interface OpenExamplesDialogProps {
  open: boolean;
  onClose: () => void;
}

export function OpenExamplesDialog({ open, onClose }: OpenExamplesDialogProps) {
  const { t, locale } = useI18n();
  const openFolderAt = useWorkspaceStore((s) => s.openFolderAt);
  const [examples, setExamples] = useState<BundledExample[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setBusyId(null);
    if (!isTauriRuntime()) {
      setExamples([]);
      setError(t("examples.needDesktop"));
      return;
    }
    setLoading(true);
    void listBundledExamples()
      .then((list) => {
        setExamples(list.map((ex) => localizeExample(ex, locale)));
        setLoading(false);
      })
      .catch((err) => {
        setExamples([]);
        setLoading(false);
        setError(err instanceof Error ? err.message : String(err));
      });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busyId) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose, busyId, t, locale]);

  if (!open) return null;

  const openExample = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    try {
      const path = await materializeBundledExample(id);
      onClose();
      await openFolderAt(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusyId(null);
    }
  };

  const openDocs = async (url: string) => {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[10vh]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busyId) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("examples.title")}
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded border border-aether-border bg-aether-surface shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-aether-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-aether-fg">
            <BookOpen size={16} className="text-aether-fg-muted" />
            {t("examples.title")}
          </div>
          <button
            type="button"
            disabled={!!busyId}
            onClick={onClose}
            className="rounded p-1 text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg disabled:opacity-40"
            aria-label={t("settings.close")}
          >
            <X size={16} />
          </button>
        </div>

        <p className="border-b border-aether-border px-4 py-2.5 text-[11px] leading-relaxed text-aether-fg-muted">
          {t("examples.hint")}
        </p>

        <div className="grid max-h-[55vh] grid-cols-1 gap-2 overflow-y-auto p-3 sm:grid-cols-2">
          {loading && (
            <p className="col-span-full px-2 py-4 text-center text-xs text-aether-fg-dim">
              {t("common.loading")}
            </p>
          )}
          {!loading &&
            examples.map((ex) => {
              const busy = busyId === ex.id;
              const isWifi = ex.id === "esp32-wifi";
              return (
                <div
                  key={ex.id}
                  className={cn(
                    "flex flex-col rounded border border-aether-border bg-aether-bg p-3",
                    "hover:border-aether-border-subtle",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-xs font-medium text-aether-fg">
                      {ex.title}
                    </span>
                    {(ex.tags ?? []).map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-aether-surface-raised px-1.5 py-px text-[9px] uppercase tracking-wide text-aether-fg-muted"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1.5 flex-1 text-[11px] leading-relaxed text-aether-fg-muted">
                    {ex.description}
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={!!busyId}
                      onClick={() => void openExample(ex.id)}
                      className="rounded border border-aether-accent bg-aether-accent px-2.5 py-1 text-[11px] text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {busy ? t("examples.copying") : t("examples.open")}
                    </button>
                    {isWifi && (
                      <button
                        type="button"
                        onClick={() => void openDocs(WIFI_DOCS)}
                        className="inline-flex items-center gap-1 text-[11px] text-aether-accent hover:underline"
                      >
                        <ExternalLink size={11} />
                        {t("examples.docs")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {error && (
          <p className="border-t border-aether-border px-4 py-2 text-[11px] text-aether-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
