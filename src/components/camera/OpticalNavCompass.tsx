import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import { useOpticalNavStore } from "@/stores/opticalNavStore";

/** Compact home compass overlaid on the camera preview. */
export function OpticalNavCompass() {
  const { t } = useI18n();
  const enabled = useOpticalNavStore((s) => s.enabled);
  const estimate = useOpticalNavStore((s) => s.estimate);

  if (!enabled || !estimate) return null;

  const { home } = estimate;
  // Needle points toward home in the vehicle body frame (0° = up = nose)
  const needleDeg = home.relativeBearingDeg;
  const dist =
    home.distanceM >= 100
      ? `${(home.distanceM / 1000).toFixed(2)} km`
      : `${home.distanceM.toFixed(1)} m`;

  return (
    <div
      className={cn(
        "pointer-events-none absolute bottom-3 right-3 flex flex-col items-center gap-0.5",
        "rounded-md border border-white/20 bg-black/55 px-2 py-1.5 text-white shadow-sm backdrop-blur-[2px]",
      )}
      role="img"
      aria-label={t("opticalNav.compassAria", {
        dist,
        brg: Math.round(home.bearingToHomeDeg),
      })}
    >
      <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden>
        <circle
          cx="28"
          cy="28"
          r="25"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="1.5"
        />
        {/* Up = vehicle nose; needle = direction to home in body frame */}
        <path d="M28 4 L30.5 10 L25.5 10 Z" fill="rgba(255,255,255,0.85)" />
        <g transform={`rotate(${needleDeg} 28 28)`}>
          <line
            x1="28"
            y1="28"
            x2="28"
            y2="10"
            stroke="#7dd3a0"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <circle cx="28" cy="10" r="2.5" fill="#7dd3a0" />
        </g>
        <circle cx="28" cy="28" r="2" fill="rgba(255,255,255,0.9)" />
      </svg>
      <div className="font-mono text-[10px] leading-tight tracking-tight">
        <span className="text-[#7dd3a0]">{dist}</span>
        <span className="text-white/50"> · </span>
        <span>{Math.round(home.bearingToHomeDeg)}°</span>
      </div>
      <div className="text-[9px] leading-none text-white/55">
        {t("opticalNav.compassHome")}
      </div>
    </div>
  );
}
