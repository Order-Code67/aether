import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import { RC_CHANNEL_LABELS, type RcChannels } from "@/lib/mspTuning";
import { pollRcChannels } from "@/lib/mspTuningIo";

interface Props {
  connected: boolean;
  sessionActive: boolean;
}

function channelBar(pwm: number): number {
  const pct = ((pwm - 1000) / 1000) * 100;
  return Math.max(0, Math.min(100, pct));
}

export function InavReceiverCard({ connected, sessionActive }: Props) {
  const { t } = useI18n();
  const [rc, setRc] = useState<RcChannels | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [livePoll, setLivePoll] = useState(false);
  const timer = useRef<number | null>(null);
  const live = connected && sessionActive;

  useEffect(() => {
    if (!live || !livePoll) {
      if (timer.current != null) {
        window.clearInterval(timer.current);
        timer.current = null;
      }
      return;
    }
    let cancelled = false;
    const tick = async () => {
      const result = await pollRcChannels();
      if (cancelled) return;
      if (result.ok) {
        setRc(result.rc);
        setError(null);
      } else {
        setError(result.error);
      }
    };
    void tick();
    timer.current = window.setInterval(() => void tick(), 350);
    return () => {
      cancelled = true;
      if (timer.current != null) {
        window.clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, [live, livePoll]);

  return (
    <section
      className="space-y-2 rounded border border-aether-border bg-aether-surface-raised/40 p-2"
      data-testid="inav-receiver-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-aether-fg-dim">
            {t("inav.rx.title")}
          </p>
          <p className="text-[10px] text-aether-fg-dim">{t("inav.rx.hint")}</p>
        </div>
        <button
          type="button"
          disabled={!live}
          data-testid="inav-rx-toggle"
          onClick={() => setLivePoll((v) => !v)}
          className={cn(
            "h-7 rounded border px-2 text-[11px]",
            livePoll
              ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
              : "border-aether-border text-aether-fg hover:bg-aether-surface-raised",
            "disabled:opacity-40",
          )}
        >
          {livePoll ? t("inav.rx.stop") : t("inav.rx.start")}
        </button>
      </div>

      {!live && (
        <p className="text-[11px] text-aether-fg-dim">{t("inav.msp.needConnect")}</p>
      )}
      {error && <p className="text-[11px] text-aether-danger">{error}</p>}

      {rc ? (
        <ul className="space-y-1.5">
          {rc.channels.slice(0, 12).map((pwm, i) => (
            <li key={i} className="flex items-center gap-2 text-[11px]">
              <span className="w-14 shrink-0 font-mono text-aether-fg-dim">
                {RC_CHANNEL_LABELS[i] ?? `CH${i + 1}`}
              </span>
              <div className="relative h-2 flex-1 overflow-hidden rounded bg-aether-bg">
                <div
                  className="absolute inset-y-0 left-0 bg-aether-accent/70"
                  style={{ width: `${channelBar(pwm)}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right font-mono text-aether-fg">
                {pwm}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-aether-fg-dim">{t("inav.rx.empty")}</p>
      )}
    </section>
  );
}
