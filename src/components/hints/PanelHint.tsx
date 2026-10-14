import { useI18n } from "@/hooks/useI18n";
import type { MessageKey } from "@/i18n";
import { cn } from "@/lib/cn";
import { useSettingsStore } from "@/stores/settingsStore";

interface PanelHintProps {
  messageKey: MessageKey;
  className?: string;
  /** When true, always show (ignore Hints mode). Default false. */
  always?: boolean;
}

/** Short instructional line shown when Hints mode is on. */
export function PanelHint({ messageKey, className, always }: PanelHintProps) {
  const { t } = useI18n();
  const hintsEnabled = useSettingsStore((s) => s.hintsEnabled);
  if (!always && !hintsEnabled) return null;

  return (
    <p
      data-testid="panel-hint"
      className={cn(
        "rounded border border-aether-border/70 bg-aether-bg/40 px-2 py-1.5 text-[11px] leading-relaxed text-aether-fg-muted",
        className,
      )}
    >
      {t(messageKey)}
    </p>
  );
}
