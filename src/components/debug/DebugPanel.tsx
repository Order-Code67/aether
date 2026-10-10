import type { ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bug,
  Circle,
  Pause,
  Play,
  Square,
  StepForward,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useDebugStore } from "@/stores/debugStore";
import { useEditorStore } from "@/stores/editorStore";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function DebugPanel() {
  const sessionActive = useDebugStore((s) => s.sessionActive);
  const execState = useDebugStore((s) => s.execState);
  const error = useDebugStore((s) => s.error);
  const breakpoints = useDebugStore((s) => s.breakpoints);
  const frames = useDebugStore((s) => s.frames);
  const variables = useDebugStore((s) => s.variables);
  const stoppedFile = useDebugStore((s) => s.stoppedFile);
  const stoppedLine = useDebugStore((s) => s.stoppedLine);
  const start = useDebugStore((s) => s.start);
  const stop = useDebugStore((s) => s.stop);
  const continueExec = useDebugStore((s) => s.continueExec);
  const pause = useDebugStore((s) => s.pause);
  const stepOver = useDebugStore((s) => s.stepOver);
  const stepInto = useDebugStore((s) => s.stepInto);
  const stepOut = useDebugStore((s) => s.stepOut);
  const toggleBreakpoint = useDebugStore((s) => s.toggleBreakpoint);
  const clearBreakpoints = useDebugStore((s) => s.clearBreakpoints);

  const kind = useWorkspaceStore((s) => s.kind);
  const isProject = usePlatformIoStore((s) => s.isProject);
  const selectedEnv = usePlatformIoStore((s) => s.selectedEnv);
  const envs = usePlatformIoStore((s) => s.envs);
  const setSelectedEnv = usePlatformIoStore((s) => s.setSelectedEnv);

  const stopped = execState === "stopped";
  const running = execState === "running" || execState === "starting";

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-9 shrink-0 items-center justify-between gap-2 px-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-aether-fg-muted">
          Run and Debug
        </h2>
        <Bug size={14} className="text-aether-fg-muted" />
      </header>

      <div className="aether-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-3 pb-4">
        <p className="text-[11px] leading-relaxed text-aether-fg-dim">
          Starts{" "}
          <span className="font-mono text-aether-fg-muted">
            pio debug --interpreter=mi2
          </span>
          . Configure{" "}
          <span className="font-mono text-aether-fg-muted">debug_tool</span> in
          platformio.ini. Click the editor gutter to toggle breakpoints.
        </p>

        {kind === "folder" && isProject && envs.length > 0 && (
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-aether-fg-muted">Environment</span>
            <select
              value={selectedEnv}
              disabled={sessionActive}
              onChange={(e) => setSelectedEnv(e.target.value)}
              className="h-7 rounded border border-aether-border bg-aether-bg px-1 text-xs text-aether-fg outline-none focus:border-aether-accent"
            >
              {envs.map((env) => (
                <option key={env} value={env}>
                  {env}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex flex-wrap gap-1">
          {!sessionActive ? (
            <ToolBtn
              title="Start Debugging"
              disabled={kind !== "folder" || !isProject}
              onClick={() => void start()}
            >
              <Play size={14} />
              Start
            </ToolBtn>
          ) : (
            <ToolBtn title="Stop" danger onClick={() => void stop()}>
              <Square size={14} />
              Stop
            </ToolBtn>
          )}
          <ToolBtn
            title="Continue"
            disabled={!sessionActive || !stopped}
            onClick={() => void continueExec()}
          >
            <Play size={14} />
          </ToolBtn>
          <ToolBtn
            title="Pause"
            disabled={!sessionActive || !running || stopped}
            onClick={() => void pause()}
          >
            <Pause size={14} />
          </ToolBtn>
          <ToolBtn
            title="Step Over"
            disabled={!sessionActive || !stopped}
            onClick={() => void stepOver()}
          >
            <StepForward size={14} />
          </ToolBtn>
          <ToolBtn
            title="Step Into"
            disabled={!sessionActive || !stopped}
            onClick={() => void stepInto()}
          >
            <ArrowDownToLine size={14} />
          </ToolBtn>
          <ToolBtn
            title="Step Out"
            disabled={!sessionActive || !stopped}
            onClick={() => void stepOut()}
          >
            <ArrowUpFromLine size={14} />
          </ToolBtn>
        </div>

        <div className="text-[11px] text-aether-fg-muted">
          Status:{" "}
          <span className="text-aether-fg">
            {sessionActive ? execState : "inactive"}
          </span>
          {stoppedFile && stoppedLine != null && (
            <span className="text-aether-fg-dim">
              {" "}
              · {stoppedFile.split(/[/\\]/).pop()}:{stoppedLine}
            </span>
          )}
        </div>

        {error && (
          <p className="text-[11px] leading-relaxed text-aether-danger">
            {error}
          </p>
        )}

        <Section
          title="Call Stack"
          empty={frames.length === 0 ? "No stack (paused at a breakpoint)." : null}
        >
          {frames.map((frame) => (
            <button
              key={`${frame.level}-${frame.function}-${frame.line}`}
              type="button"
              className="flex w-full flex-col gap-0.5 rounded px-1.5 py-1 text-left text-xs hover:bg-aether-surface-raised"
              onClick={() => {
                if (!frame.file || !frame.line) return;
                void useWorkspaceStore
                  .getState()
                  .openPathInEditor(frame.file)
                  .then(() => {
                    useEditorStore.getState().requestReveal({
                      path: frame.file!,
                      lineNumber: frame.line!,
                      column: 1,
                    });
                  });
              }}
            >
              <span className="truncate text-aether-fg">
                {frame.function ?? "(unknown)"}
              </span>
              <span className="truncate text-[11px] text-aether-fg-dim">
                {frame.file
                  ? `${frame.file.split(/[/\\]/).pop()}:${frame.line ?? "?"}`
                  : "—"}
              </span>
            </button>
          ))}
        </Section>

        <Section
          title="Variables"
          empty={
            variables.length === 0 ? "No locals (pause to inspect)." : null
          }
        >
          {variables.map((v) => (
            <div
              key={v.name}
              className="flex gap-2 px-1.5 py-0.5 font-mono text-[11px]"
            >
              <span className="shrink-0 text-aether-accent">{v.name}</span>
              <span className="min-w-0 truncate text-aether-fg-muted">
                {v.value}
              </span>
            </div>
          ))}
        </Section>

        <Section
          title="Breakpoints"
          action={
            breakpoints.length > 0 ? (
              <button
                type="button"
                title="Clear all"
                onClick={clearBreakpoints}
                className="text-aether-fg-dim hover:text-aether-fg"
              >
                <Trash2 size={12} />
              </button>
            ) : null
          }
          empty={
            breakpoints.length === 0
              ? "Click the editor gutter to add breakpoints."
              : null
          }
        >
          {breakpoints.map((bp) => (
            <button
              key={`${bp.path}:${bp.line}`}
              type="button"
              className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs hover:bg-aether-surface-raised"
              onClick={() => {
                void useWorkspaceStore
                  .getState()
                  .openPathInEditor(bp.path)
                  .then(() => {
                    useEditorStore.getState().requestReveal({
                      path: bp.path,
                      lineNumber: bp.line,
                      column: 1,
                    });
                  });
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                toggleBreakpoint(bp.path, bp.line);
              }}
            >
              <Circle
                size={10}
                className="shrink-0 fill-aether-danger text-aether-danger"
              />
              <span className="min-w-0 truncate text-aether-fg">
                {bp.path.split(/[/\\]/).pop()}:{bp.line}
              </span>
            </button>
          ))}
        </Section>
      </div>
    </div>
  );
}

function ToolBtn({
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
        "flex h-7 items-center gap-1 rounded border border-aether-border px-2 text-[11px]",
        danger
          ? "text-aether-danger hover:bg-aether-surface-raised"
          : "text-aether-fg hover:bg-aether-surface-raised",
        "disabled:opacity-40",
      )}
    >
      {children}
    </button>
  );
}

function Section({
  title,
  children,
  empty,
  action,
}: {
  title: string;
  children: ReactNode;
  empty: string | null;
  action?: ReactNode;
}) {
  return (
    <section>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-aether-fg-muted">
          {title}
        </h3>
        {action}
      </div>
      {empty ? (
        <p className="text-[11px] text-aether-fg-dim">{empty}</p>
      ) : (
        <div className="rounded border border-aether-border/60 bg-aether-bg/40 py-0.5">
          {children}
        </div>
      )}
    </section>
  );
}
