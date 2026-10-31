import { cn } from "@/utils/cn";

interface StatusBadgeProps {
  label: string;
  tone?: "neutral" | "ok" | "warn" | "danger";
}

export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        tone === "neutral" && "border-ags-border text-ags-muted",
        tone === "ok" && "border-ags-success/40 text-ags-success",
        tone === "warn" && "border-ags-warning/40 text-ags-warning",
        tone === "danger" && "border-ags-danger/40 text-ags-danger",
      )}
    >
      {label}
    </span>
  );
}
