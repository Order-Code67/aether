import { AlertTriangle, ExternalLink, X } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import {
  CH340_DRIVERS_URL,
  CP210X_DRIVERS_URL,
  classifyComDriverIssue,
  comDriverIssueBlurb,
  isWindowsPlatform,
  openExternalUrl,
  openOptionalFeaturesSafe,
  type ComDriverIssueKind,
} from "@/lib/comDrivers";
import { cn } from "@/lib/cn";

interface ComDriversHelpProps {
  /** Raw error text from serial open / upload / PIO. */
  error?: string | null;
  /** Force empty-ports state (Serial toolbar). */
  portsEmpty?: boolean;
  /** Compact single-line variant for toolbars. */
  compact?: boolean;
  className?: string;
  onDismiss?: () => void;
}

export function ComDriversHelp({
  error,
  portsEmpty,
  compact,
  className,
  onDismiss,
}: ComDriversHelpProps) {
  const { t, locale } = useI18n();
  const kind: ComDriverIssueKind = classifyComDriverIssue(error, {
    portsEmpty,
  });
  if (!kind) return null;

  const blurb = comDriverIssueBlurb(kind, locale);
  const existsVsOpen =
    kind === "access_denied" || kind === "open_failed"
      ? t("drivers.portExistsWontOpen")
      : t("drivers.portMissing");

  return (
    <div
      role="status"
      data-aether-chrome
      className={cn(
        "border-aether-warning/40 bg-aether-warning/10 text-aether-fg",
        compact
          ? "flex flex-wrap items-center gap-2 border-t px-2 py-1.5 text-[11px]"
          : "mx-2 mb-2 rounded border px-2.5 py-2 text-[11px]",
        className,
      )}
    >
      <div className={cn("flex min-w-0 flex-1 gap-2", compact && "items-center")}>
        <AlertTriangle
          size={13}
          className="mt-0.5 shrink-0 text-aether-warning"
        />
        <div className="min-w-0 space-y-0.5">
          <p className="font-medium">
            {blurb.title}
            <span className="ml-1 font-normal text-aether-fg-muted">
              — {existsVsOpen}
            </span>
          </p>
          {!compact && (
            <p className="leading-relaxed text-aether-fg-muted">{blurb.body}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => void openExternalUrl(CH340_DRIVERS_URL)}
              className="inline-flex items-center gap-1 text-aether-accent hover:underline"
            >
              <ExternalLink size={11} />
              {t("doctor.openCh340")}
            </button>
            <button
              type="button"
              onClick={() => void openExternalUrl(CP210X_DRIVERS_URL)}
              className="inline-flex items-center gap-1 text-aether-accent hover:underline"
            >
              <ExternalLink size={11} />
              {t("doctor.openCp210x")}
            </button>
            {isWindowsPlatform() && (
              <button
                type="button"
                onClick={() => void openOptionalFeaturesSafe()}
                className="inline-flex items-center gap-1 text-aether-accent hover:underline"
              >
                <ExternalLink size={11} />
                {t("doctor.openOptionalFeatures")}
              </button>
            )}
          </div>
        </div>
      </div>
      {onDismiss && (
        <button
          type="button"
          title={t("doctor.dismiss")}
          aria-label={t("doctor.dismiss")}
          onClick={onDismiss}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
