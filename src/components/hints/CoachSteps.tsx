import { Navigation, Radio, Rocket, X } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import { useLayoutStore } from "@/stores/layoutStore";
import { usePaletteStore } from "@/stores/paletteStore";
import { useSettingsStore } from "@/stores/settingsStore";

interface CoachStepsProps {
  className?: string;
}

/**
 * First-open coach: Blink → LoRa → Configurator (matches onboarding tour).
 * Visible while Hints mode is on and the coach has not been dismissed.
 */
export function CoachSteps({ className }: CoachStepsProps) {
  const { t } = useI18n();
  const hintsEnabled = useSettingsStore((s) => s.hintsEnabled);
  const dismissed = useSettingsStore((s) => s.hintsCoachDismissed);
  const setHintsCoachDismissed = useSettingsStore(
    (s) => s.setHintsCoachDismissed,
  );
  const setActiveActivity = useLayoutStore((s) => s.setActiveActivity);
  const requestOnboarding = usePaletteStore((s) => s.requestOnboarding);

  if (!hintsEnabled || dismissed) return null;

  const steps: {
    icon: typeof Rocket;
    text: string;
    onCta?: () => void;
    cta?: string;
  }[] = [
    {
      icon: Rocket,
      text: t("hints.coach.step1"),
      cta: t("hints.coach.cta.blink"),
      onCta: () => requestOnboarding(),
    },
    {
      icon: Radio,
      text: t("hints.coach.step2"),
      cta: t("hints.coach.cta.lora"),
      onCta: () => requestOnboarding(),
    },
    {
      icon: Navigation,
      text: t("hints.coach.step3"),
      cta: t("hints.coach.cta.configurator"),
      onCta: () => setActiveActivity("inav"),
    },
  ];

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
      <ol className="space-y-1.5 text-[11px] leading-snug text-aether-fg-muted">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <li key={step.text} className="flex items-start gap-1.5">
              <Icon size={12} className="mt-0.5 shrink-0 text-cyan-300/80" />
              <span className="min-w-0 flex-1">
                {step.text}
                {step.onCta && step.cta ? (
                  <>
                    {" "}
                    <button
                      type="button"
                      onClick={step.onCta}
                      className="text-aether-accent underline-offset-2 hover:underline"
                    >
                      {step.cta}
                    </button>
                  </>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
