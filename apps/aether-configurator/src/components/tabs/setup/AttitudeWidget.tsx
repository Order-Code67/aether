import type { AttitudeSnapshot } from "@/core/protocols/msp/telemetry";

/** Simple artificial horizon for Setup — not a full glass cockpit. */
export function AttitudeWidget({
  attitude,
}: {
  attitude: AttitudeSnapshot | null;
}) {
  const roll = attitude?.roll ?? 0;
  const pitch = attitude?.pitch ?? 0;
  // Clamp pitch visual so the horizon stays readable.
  const pitchOffset = Math.max(-40, Math.min(40, pitch)) * 1.4;

  return (
    <div className="relative mx-auto h-40 w-40 overflow-hidden rounded-full border border-border bg-surface-2 shadow-inner">
      <div
        className="absolute inset-[-40%] transition-transform duration-150 ease-out"
        style={{
          transform: `rotate(${-roll}deg) translateY(${pitchOffset}px)`,
        }}
      >
        <div className="h-1/2 w-full bg-[#3d6ea5]" />
        <div className="h-1/2 w-full bg-[#6b4f2a]" />
        <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-fg/80" />
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-0.5 w-10 bg-accent" />
        <div className="absolute h-3 w-3 rounded-full border-2 border-accent bg-transparent" />
      </div>
      <div className="pointer-events-none absolute bottom-2 left-0 right-0 text-center font-mono text-[10px] text-fg">
        R {roll.toFixed(1)}° · P {pitch.toFixed(1)}° · Y{" "}
        {attitude ? attitude.yaw.toFixed(0) : "—"}°
      </div>
    </div>
  );
}
