import { useEffect, useRef } from "react";
import { Eraser, Square } from "lucide-react";
import { ComDriversHelp } from "@/components/serial/ComDriversHelp";
import { useI18n } from "@/hooks/useI18n";
import type { MessageKey } from "@/i18n";
import { cn } from "@/lib/cn";
import type { PioStage } from "@/lib/pioProgress";
import { usePlatformIoStore } from "@/stores/platformioStore";

const STAGE_KEYS: Partial<Record<PioStage, MessageKey>> = {
  starting: "pio.stage.starting",
  compiling: "pio.stage.compiling",
  linking: "pio.stage.linking",
  uploading: "pio.stage.uploading",
  installing: "pio.stage.installing",
  done: "pio.stage.done",
  failed: "pio.stage.failed",
};

export function OutputPanel() {
  const { t } = useI18n();
  const lines = usePlatformIoStore((s) => s.lines);
  const running = usePlatformIoStore((s) => s.running);
  const progress = usePlatformIoStore((s) => s.progress);
  const error = usePlatformIoStore((s) => s.error);
  const clearOutput = usePlatformIoStore((s) => s.clearOutput);
  const cancel = usePlatformIoStore((s) => s.cancel);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [lines]);

  const stageKey = STAGE_KEYS[progress.stage];
  const header = running
    ? stageKey
      ? `${t(stageKey)}${progress.percent != null ? ` ${progress.percent}%` : ""}`
      : t("pio.running")
    : t("pio.outputTitle");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-7 shrink-0 items-center justify-between border-b border-aether-border px-2">
        <span className="truncate text-[11px] text-aether-fg-muted">
          {header}
        </span>
        <div className="flex items-center gap-0.5">
          {running && (
            <button
              type="button"
              title="Cancel"
              onClick={() => {
                void cancel();
              }}
              className="flex h-6 items-center gap-1 rounded px-1.5 text-[11px] text-aether-danger hover:bg-aether-surface-raised"
            >
              <Square size={11} />
              Cancel
            </button>
          )}
          <button
            type="button"
            title="Clear"
            aria-label="Clear output"
            onClick={clearOutput}
            className="flex h-6 w-6 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
          >
            <Eraser size={12} />
          </button>
        </div>
      </div>

      <div
        ref={logRef}
        className="aether-scroll min-h-0 flex-1 overflow-auto px-3 py-2 font-mono text-[11px] leading-5"
      >
        {lines.length === 0 ? (
          <p className="text-aether-fg-dim">
            Build / Upload output will appear here.
          </p>
        ) : (
          lines.map((line) => (
            <div
              key={line.id}
              className={cn(
                "whitespace-pre-wrap break-all",
                line.stream === "stderr" && "text-aether-warning",
                line.stream === "system" && "text-aether-accent",
                line.stream === "stdout" && "text-aether-fg",
              )}
            >
              {line.text}
            </div>
          ))
        )}
      </div>

      {error && (
        <div className="border-t border-aether-border px-3 py-1 text-[11px] text-aether-danger">
          {error}
        </div>
      )}
      {error && <ComDriversHelp compact error={error} />}
    </div>
  );
}
