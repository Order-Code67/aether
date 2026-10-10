import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

interface CircuitBackgroundProps {
  className?: string;
}

/**
 * Subtle PCB-trace backdrop for Welcome (and empty editor).
 * CSS/SVG animations only — paused when the document is hidden.
 */
export function CircuitBackground({ className }: CircuitBackgroundProps) {
  const [active, setActive] = useState(true);

  useEffect(() => {
    const sync = () => setActive(!document.hidden);
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        !active && "aether-circuit-paused",
        className,
      )}
      aria-hidden
    >
      <div className="aether-circuit-pan absolute -inset-[8%] opacity-90">
        <svg
          className="h-full w-full"
          viewBox="0 0 960 640"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="aether-pcb-trace" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1a3a44" />
              <stop offset="45%" stopColor="#2a6f7a" />
              <stop offset="100%" stopColor="#1e4a55" />
            </linearGradient>
            <radialGradient id="aether-pcb-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#3d9eff" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#3d9eff" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Deep slate board */}
          <rect width="960" height="640" fill="#14181c" />
          <rect
            width="960"
            height="640"
            fill="url(#aether-pcb-glow)"
            opacity="0.25"
          />

          {/* Horizontal / vertical traces */}
          <g
            className="aether-circuit-traces"
            fill="none"
            stroke="url(#aether-pcb-trace)"
            strokeWidth="1.25"
            strokeLinecap="square"
          >
            <path d="M40 80 H220 V180 H360 V120 H520" />
            <path d="M80 280 H200 V400 H340 V340 H480 V480" />
            <path d="M560 60 V200 H700 V140 H880" />
            <path d="M600 300 H760 V420 H900" />
            <path d="M120 520 H300 V560 H460" />
            <path d="M520 500 H680 V580 H840" />
            <path d="M40 200 H140 V260" />
            <path d="M400 220 H520 V280 H640" />
            <path d="M720 240 V320 H820 V380" />
            <path d="M200 60 V140 H280" />
          </g>

          {/* Pulse overlay on select traces */}
          <g
            className="aether-circuit-pulse"
            fill="none"
            stroke="#5ec8d4"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.55"
          >
            <path d="M40 80 H220 V180 H360" />
            <path d="M560 60 V200 H700" />
            <path d="M200 60 V140 H280" pathLength="100" />
          </g>

          {/* IC package */}
          <g transform="translate(380 240)">
            <rect
              x="0"
              y="0"
              width="200"
              height="140"
              rx="4"
              fill="#1c242c"
              stroke="#2f4a52"
              strokeWidth="1.5"
            />
            <rect
              x="18"
              y="18"
              width="164"
              height="104"
              rx="2"
              fill="#151a20"
              stroke="#3a5c66"
              strokeWidth="1"
            />
            {/* pads */}
            {Array.from({ length: 8 }).map((_, i) => (
              <g key={i}>
                <rect
                  x={-10}
                  y={16 + i * 14}
                  width="10"
                  height="6"
                  fill="#3d6a74"
                  className="aether-circuit-pad"
                />
                <rect
                  x={200}
                  y={16 + i * 14}
                  width="10"
                  height="6"
                  fill="#3d6a74"
                  className="aether-circuit-pad"
                />
              </g>
            ))}
            <circle
              cx="100"
              cy="70"
              r="18"
              fill="none"
              stroke="#2a6f7a"
              strokeWidth="1"
              className="aether-circuit-node"
            />
            <circle
              cx="100"
              cy="70"
              r="4"
              fill="#5ec8d4"
              className="aether-circuit-node-core"
            />
          </g>

          {/* Via nodes */}
          <g fill="#3d6a74" className="aether-circuit-vias">
            <circle cx="220" cy="80" r="3.5" />
            <circle cx="360" cy="180" r="3.5" />
            <circle cx="520" cy="120" r="3.5" />
            <circle cx="200" cy="400" r="3.5" />
            <circle cx="480" cy="340" r="3.5" />
            <circle cx="700" cy="200" r="3.5" />
            <circle cx="760" cy="420" r="3.5" />
            <circle cx="300" cy="520" r="3.5" />
            <circle cx="280" cy="140" r="3.5" />
          </g>
        </svg>
      </div>

      {/* Scrim for readable CTAs */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1e1e1e]/75 via-[#1e1e1e]/55 to-[#1e1e1e]/85" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#1e1e1ecc_72%)]" />
    </div>
  );
}
