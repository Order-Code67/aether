import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "ok" | "warn" | "danger" | "accent";
}) {
  const tones = {
    neutral: "bg-surface-2 text-fg-muted border-border",
    ok: "bg-ok/15 text-ok border-ok/30",
    warn: "bg-warn/15 text-warn border-warn/30",
    danger: "bg-danger/15 text-danger border-danger/30",
    accent: "bg-accent/15 text-accent border-accent/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
