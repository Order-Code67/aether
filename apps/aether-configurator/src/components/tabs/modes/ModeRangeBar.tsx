import {
  isPwmInRange,
  modeRangeToPwm,
  pwmBarPercent,
} from "@/core/protocols/msp/modes";
import { cn } from "@/lib/cn";

/** Visual AUX range with optional live stick marker. */
export function ModeRangeBar({
  startStep,
  endStep,
  livePwm,
}: {
  startStep: number;
  endStep: number;
  livePwm?: number;
}) {
  const startPct = pwmBarPercent(modeRangeToPwm(startStep));
  const endPct = pwmBarPercent(modeRangeToPwm(endStep));
  const left = Math.min(startPct, endPct);
  const width = Math.abs(endPct - startPct);
  const active =
    livePwm != null && isPwmInRange(livePwm, startStep, endStep);

  return (
    <div className="relative h-3 w-full overflow-hidden rounded bg-surface-2">
      <div
        className={cn(
          "absolute inset-y-0 rounded-sm",
          active ? "bg-ok/70" : "bg-accent/45",
        )}
        style={{ left: `${left}%`, width: `${Math.max(width, 1)}%` }}
      />
      {livePwm != null && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-fg"
          style={{ left: `${pwmBarPercent(livePwm)}%` }}
          title={`${livePwm}`}
        />
      )}
    </div>
  );
}
