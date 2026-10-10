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
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import { useDebugStore } from "@/stores/debugStore";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

/** Compact controls above the editor for PIO debug (start + continue/step/stop). */
export function DebugToolbar() {
  const { t } = useI18n();
  const kind = useWorkspaceStore((s) => s.kind);
  const isProject = usePlatformIoStore((s) => s.isProject);
  const sessionActive = useDebugStore((s) => s.sessionActive);
  const execState = useDebugStore((s) => s.execState);
  const start = useDebugStore((s) => s.start);
  const stop = useDebugStore((s) => s.stop);
  const continueExec = useDebugStore((s) => s.continueExec);
  const pause = useDebugStore((s) => s.pause);
  const stepOver = useDebugStore((s) => s.stepOver);
  const stepInto = useDebugStore((s) => s.stepInto);
  const stepOut = useDebugStore((s) => s.stepOut);

  if (kind !== "folder" || !isProject) return null;

  const stopped = execState === "stopped";
  const running = execState === "running" || execState === "starting";

  return (
    <div className="flex h-8 shrink-0 items-center gap-1 border-b border-aether-border bg-aether-activity px-2">
      <Bug size={13} className="text-aether-accent" />
      <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-aether-fg-dim">
        {t("debug.toolbar")}
        {sessionActive ? ` · ${execState}` : ""}
      </span>
      {!sessionActive ? (
        <Btn
          title={t("debug.start")}
          onClick={() => void start()}
        >
          <Play size={13} />
        </Btn>
      ) : (
        <>
          <Btn
            title={t("debug.continue")}
            disabled={!stopped}
            onClick={() => void continueExec()}
          >
            <Play size={13} />
          </Btn>
          <Btn
            title={t("debug.pause")}
            disabled={!running || stopped}
            onClick={() => void pause()}
          >
            <Pause size={13} />
          </Btn>
          <Btn
            title={t("debug.stepOver")}
            disabled={!stopped}
            onClick={() => void stepOver()}
          >
            <StepForward size={13} />
          </Btn>
          <Btn
            title={t("debug.stepInto")}
            disabled={!stopped}
            onClick={() => void stepInto()}
          >
            <ArrowDownToLine size={13} />
          </Btn>
          <Btn
            title={t("debug.stepOut")}
            disabled={!stopped}
            onClick={() => void stepOut()}
          >
            <ArrowUpFromLine size={13} />
          </Btn>
          <Btn title={t("debug.stop")} danger onClick={() => void stop()}>
            <Square size={13} />
          </Btn>
        </>
      )}
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
