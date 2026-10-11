import {
  RC_CHANNEL_LABELS,
  isChannelCentered,
  rcChannelPercent,
  type RcChannels,
} from "@/core/protocols/msp/telemetry";
import { cn } from "@/lib/cn";

export function RcChannelBars({ rc }: { rc: RcChannels | null }) {
  if (!rc || rc.channels.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-1.5">
      {rc.channels.slice(0, 12).map((pwm, i) => {
        const label = RC_CHANNEL_LABELS[i] ?? `CH${i + 1}`;
        const primary = i < 4;
        const centered = primary && isChannelCentered(pwm);
        return (
          <li key={i} className="flex items-center gap-2 text-xs">
            <span className="w-16 shrink-0 font-mono text-fg-muted">{label}</span>
            <div className="relative h-2 flex-1 overflow-hidden rounded bg-surface-2">
              <div
                className={cn(
                  "absolute inset-y-0 left-0 transition-[width]",
                  centered ? "bg-ok/80" : "bg-accent/80",
                )}
                style={{ width: `${rcChannelPercent(pwm)}%` }}
              />
              {/* Mid marker */}
              <div className="absolute inset-y-0 left-1/2 w-px bg-fg/30" />
            </div>
            <span className="w-10 shrink-0 text-right font-mono tabular-nums">
              {pwm}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
