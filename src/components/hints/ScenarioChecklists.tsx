import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import type { MessageKey } from "@/i18n";
import { cn } from "@/lib/cn";
import { useLayoutStore } from "@/stores/layoutStore";
import { usePaletteStore } from "@/stores/paletteStore";
import { useSettingsStore } from "@/stores/settingsStore";

type ScenarioId = "blink" | "lora" | "bpla";

const SCENARIOS: {
  id: ScenarioId;
  titleKey: MessageKey;
  stepKeys: MessageKey[];
  ctaKey: MessageKey;
}[] = [
  {
    id: "blink",
    titleKey: "hints.checklist.blink.title",
    stepKeys: [
      "hints.checklist.blink.step1",
      "hints.checklist.blink.step2",
      "hints.checklist.blink.step3",
      "hints.checklist.blink.step4",
      "hints.checklist.blink.step5",
    ],
    ctaKey: "hints.checklist.cta.blink",
  },
  {
    id: "lora",
    titleKey: "hints.checklist.lora.title",
    stepKeys: [
      "hints.checklist.lora.step1",
      "hints.checklist.lora.step2",
      "hints.checklist.lora.step3",
      "hints.checklist.lora.step4",
      "hints.checklist.lora.step5",
    ],
    ctaKey: "hints.checklist.cta.lora",
  },
  {
    id: "bpla",
    titleKey: "hints.checklist.bpla.title",
    stepKeys: [
      "hints.checklist.bpla.step1",
      "hints.checklist.bpla.step2",
      "hints.checklist.bpla.step3",
      "hints.checklist.bpla.step4",
      "hints.checklist.bpla.step5",
    ],
    ctaKey: "hints.checklist.cta.bpla",
  },
];

interface ScenarioChecklistsProps {
  className?: string;
}

/**
 * Scenario step checklists (Blink / LoRa / UAV→Configurator).
 * Visible while Hints mode is on; checkmarks persist in settings.
 */
export function ScenarioChecklists({ className }: ScenarioChecklistsProps) {
  const { t } = useI18n();
  const hintsEnabled = useSettingsStore((s) => s.hintsEnabled);
  const checked = useSettingsStore((s) => s.hintsChecklistChecked);
  const toggleChecked = useSettingsStore((s) => s.toggleHintsChecklistStep);
  const requestOnboarding = usePaletteStore((s) => s.requestOnboarding);
  const setActiveActivity = useLayoutStore((s) => s.setActiveActivity);
  const [openId, setOpenId] = useState<ScenarioId | null>("blink");

  if (!hintsEnabled) return null;

  const runCta = (id: ScenarioId) => {
    if (id === "blink") {
      requestOnboarding();
      return;
    }
    if (id === "lora") {
      requestOnboarding();
      setActiveActivity("boards");
      return;
    }
    setActiveActivity("inav");
  };

  return (
    <div
      data-testid="hints-scenario-checklists"
      className={cn(
        "rounded border border-aether-border/80 bg-aether-bg/40 text-left",
        className,
      )}
    >
      <p className="border-b border-aether-border/60 px-3 py-1.5 text-[11px] font-medium tracking-wide text-aether-fg">
        {t("hints.checklist.title")}
      </p>
      <div className="divide-y divide-aether-border/50">
        {SCENARIOS.map((scenario) => {
          const open = openId === scenario.id;
          const done = scenario.stepKeys.filter(
            (k) => checked[`${scenario.id}:${k}`],
          ).length;
          return (
            <div key={scenario.id}>
              <button
                type="button"
                data-testid={`hints-checklist-${scenario.id}`}
                aria-expanded={open}
                onClick={() =>
                  setOpenId((prev) =>
                    prev === scenario.id ? null : scenario.id,
                  )
                }
                className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[11px] text-aether-fg hover:bg-aether-surface-raised/60"
              >
                {open ? (
                  <ChevronDown size={12} className="shrink-0 text-aether-fg-muted" />
                ) : (
                  <ChevronRight
                    size={12}
                    className="shrink-0 text-aether-fg-muted"
                  />
                )}
                <span className="min-w-0 flex-1 font-medium">
                  {t(scenario.titleKey)}
                </span>
                <span className="shrink-0 text-[10px] text-aether-fg-dim">
                  {done}/{scenario.stepKeys.length}
                </span>
              </button>
              {open && (
                <div className="px-3 pb-2 pt-0.5">
                  <ul className="space-y-1">
                    {scenario.stepKeys.map((stepKey) => {
                      const key = `${scenario.id}:${stepKey}`;
                      const isOn = Boolean(checked[key]);
                      return (
                        <li key={stepKey}>
                          <label className="flex cursor-pointer items-start gap-2 text-[11px] leading-snug text-aether-fg-muted">
                            <input
                              type="checkbox"
                              checked={isOn}
                              onChange={() => toggleChecked(key)}
                              className="mt-0.5 shrink-0"
                              data-testid={`hints-check-${scenario.id}-${stepKey.split(".").pop()}`}
                            />
                            <span
                              className={isOn ? "line-through opacity-70" : ""}
                            >
                              {t(stepKey)}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                  <button
                    type="button"
                    data-testid={`hints-checklist-cta-${scenario.id}`}
                    onClick={() => runCta(scenario.id)}
                    className="mt-2 rounded border border-aether-border px-2 py-1 text-[11px] text-aether-accent hover:border-aether-accent"
                  >
                    {t(scenario.ctaKey)}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
