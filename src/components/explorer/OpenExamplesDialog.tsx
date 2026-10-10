import { useEffect, useState } from "react";
import { BookOpen, X } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  listBundledExamples,
  materializeBundledExample,
  type BundledExample,
} from "@/lib/examples";
import { isTauriRuntime } from "@/lib/tauri";
import { useI18n } from "@/hooks/useI18n";
import { useWorkspaceStore } from "@/stores/workspaceStore";

interface OpenExamplesDialogProps {
  open: boolean;
  onClose: () => void;
}

export function OpenExamplesDialog({ open, onClose }: OpenExamplesDialogProps) {
  const { t } = useI18n();
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
        setExamples(list);
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
  }, [open, onClose, busyId, t]);

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

  return (
    <div
      className="absolute inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[12vh]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busyId) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("examples.title")}
        className="flex w-full max-w-lg flex-col overflow-hidden rounded border border-aether-border bg-aether-surface shadow-2xl"
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

        <div className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto p-3">
          {loading && (
            <p className="px-2 py-4 text-center text-xs text-aether-fg-dim">
              {t("common.loading")}
            </p>
          )}
          {!loading &&
            examples.map((ex) => {
              const busy = busyId === ex.id;
              return (
                <button
                  key={ex.id}
                  type="button"
                  disabled={!!busyId}
                  onClick={() => void openExample(ex.id)}
                  className={cn(
                    "flex w-full flex-col items-start rounded border border-aether-border bg-aether-bg px-3 py-2.5 text-left transition-colors",
                    "hover:border-aether-border-subtle hover:bg-aether-surface-raised",
                    "disabled:opacity-50",
                  )}
                >
                  <span className="text-xs font-medium text-aether-fg">
                    {ex.title}
                  </span>
                  <span className="mt-0.5 text-[11px] leading-relaxed text-aether-fg-muted">
                    {ex.description}
                  </span>
                  <span className="mt-1 text-[10px] text-aether-fg-dim">
                    {busy ? t("examples.copying") : t("examples.open")} ·{" "}
                    {ex.board}
                  </span>
                </button>
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
