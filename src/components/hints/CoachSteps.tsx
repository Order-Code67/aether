import { X } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import { useSettingsStore } from "@/stores/settingsStore";

interface CoachStepsProps {
  className?: string;
}

/**
 * First-open coach: 4 steps (folder → board/COM → Build → Upload).
 * Visible while Hints mode is on and the coach has not been dismissed.
 */
export function CoachSteps({ className }: CoachStepsProps) {
  const { t } = useI18n();
  const hintsEnabled = useSettingsStore((s) => s.hintsEnabled);
  const dismissed = useSettingsStore((s) => s.hintsCoachDismissed);
  const setHintsCoachDismissed = useSettingsStore(
    (s) => s.setHintsCoachDismissed,
  );

  if (!hintsEnabled || dismissed) return null;

  const steps = [
    t("hints.coach.step1"),
    t("hints.coach.step2"),
    t("hints.coach.step3"),
    t("hints.coach.step4"),
  ] as const;

  return (
    <div
      data-testid="hints-coach"
      className={cn(
        "rounded border border-aether-accent/35 bg-aether-accent-muted/25 px-3 py-2 text-left",
        className,
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium tracking-wide text-aether-fg">
          {t("hints.coach.title")}
        </p>
        <button
          type="button"
          data-testid="hints-coach-dismiss"
          title={t("hints.coach.dismiss")}
          aria-label={t("hints.coach.dismiss")}
          onClick={() => setHintsCoachDismissed(true)}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
        >
          <X size={12} />
        </button>
      </div>
      <ol className="space-y-0.5 text-[11px] leading-snug text-aether-fg-muted">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  );
}
