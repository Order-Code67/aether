import type { ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bug,
  Pause,
  Play,
  Square,
  StepForward,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useDebugStore } from "@/stores/debugStore";

/** Compact controls shown above the editor while a debug session is active. */
export function DebugToolbar() {
  const sessionActive = useDebugStore((s) => s.sessionActive);
  const execState = useDebugStore((s) => s.execState);
  const stop = useDebugStore((s) => s.stop);
  const continueExec = useDebugStore((s) => s.continueExec);
  const pause = useDebugStore((s) => s.pause);
  const stepOver = useDebugStore((s) => s.stepOver);
  const stepInto = useDebugStore((s) => s.stepInto);
  const stepOut = useDebugStore((s) => s.stepOut);

  if (!sessionActive) return null;

  const stopped = execState === "stopped";
  const running = execState === "running" || execState === "starting";

  return (
    <div className="flex h-8 shrink-0 items-center gap-1 border-b border-aether-border bg-aether-activity px-2">
      <Bug size={13} className="text-aether-accent" />
      <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-aether-fg-dim">
        Debug · {execState}
      </span>
      <Btn
        title="Continue (F5)"
        disabled={!stopped}
        onClick={() => void continueExec()}
      >
        <Play size={13} />
      </Btn>
      <Btn
        title="Pause"
        disabled={!running || stopped}
        onClick={() => void pause()}
      >
        <Pause size={13} />
      </Btn>
      <Btn
        title="Step Over (F10)"
        disabled={!stopped}
        onClick={() => void stepOver()}
      >
        <StepForward size={13} />
      </Btn>
      <Btn
        title="Step Into (F11)"
        disabled={!stopped}
        onClick={() => void stepInto()}
      >
        <ArrowDownToLine size={13} />
      </Btn>
      <Btn
        title="Step Out (Shift+F11)"
        disabled={!stopped}
        onClick={() => void stepOut()}
      >
        <ArrowUpFromLine size={13} />
      </Btn>
      <Btn title="Stop (Shift+F5)" danger onClick={() => void stop()}>
        <Square size={13} />
      </Btn>
    </div>
  );
}

function Btn({
  children,
  title,
  onClick,
  disabled,
  danger,
}: {
  children: ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded",
        danger ? "text-aether-danger" : "text-aether-fg",
        "hover:bg-aether-surface-raised disabled:opacity-35",
      )}
    >
      {children}
    </button>
  );
}
