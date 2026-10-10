import { FileCode2, Hammer, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/cn";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function BuildToolbar() {
  const kind = useWorkspaceStore((s) => s.kind);
  const info = usePlatformIoStore((s) => s.info);
  const isProject = usePlatformIoStore((s) => s.isProject);
  const envs = usePlatformIoStore((s) => s.envs);
  const selectedEnv = usePlatformIoStore((s) => s.selectedEnv);
  const setSelectedEnv = usePlatformIoStore((s) => s.setSelectedEnv);
  const running = usePlatformIoStore((s) => s.running);
  const runTask = usePlatformIoStore((s) => s.runTask);

  if (kind !== "folder" || !isProject) {
    return null;
  }

  const disabled = running || !info?.installed;

  return (
    <div className="flex h-8 shrink-0 items-center gap-1 border-b border-aether-border bg-aether-activity px-2">
      <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-aether-fg-dim">
        PlatformIO
      </span>

      {envs.length > 0 && (
        <select
          value={selectedEnv}
          disabled={running}
          onChange={(event) => setSelectedEnv(event.target.value)}
          className="h-6 max-w-[160px] rounded border border-aether-border bg-aether-bg px-1 text-[11px] text-aether-fg outline-none focus:border-aether-accent"
          aria-label="PlatformIO environment"
        >
          {envs.map((env) => (
            <option key={env} value={env}>
              {env}
            </option>
          ))}
        </select>
      )}

      <button
        type="button"
        title="Build (Ctrl+Shift+B)"
        disabled={disabled}
        onClick={() => {
          void runTask("build");
        }}
        className={cn(
          "flex h-6 items-center gap-1 rounded px-2 text-[11px] text-aether-fg",
          "hover:bg-aether-surface-raised disabled:opacity-40",
        )}
      >
        <Hammer size={13} />
        Build
      </button>

      <button
        type="button"
        title="Upload"
        disabled={disabled}
        onClick={() => {
          void runTask("upload");
        }}
        className={cn(
          "flex h-6 items-center gap-1 rounded px-2 text-[11px] text-aether-fg",
          "hover:bg-aether-surface-raised disabled:opacity-40",
        )}
      >
        <Upload size={13} />
        Upload
      </button>

      <button
        type="button"
        title="Clean"
        disabled={disabled}
        onClick={() => {
          void runTask("clean");
        }}
        className={cn(
          "flex h-6 items-center gap-1 rounded px-2 text-[11px] text-aether-fg-muted",
          "hover:bg-aether-surface-raised hover:text-aether-fg disabled:opacity-40",
        )}
      >
        <Trash2 size={13} />
        Clean
      </button>

      <button
        type="button"
        title="Generate compile_commands.json for IntelliSense (pio run -t compiledb)"
        disabled={disabled}
        onClick={() => {
          void runTask("compiledb");
        }}
        className={cn(
          "flex h-6 items-center gap-1 rounded px-2 text-[11px] text-aether-fg-muted",
          "hover:bg-aether-surface-raised hover:text-aether-fg disabled:opacity-40",
        )}
      >
        <FileCode2 size={13} />
        IntelliSense DB
      </button>

      {!info?.installed && (
        <span className="ml-2 text-[11px] text-aether-warning">
          PlatformIO CLI not found
        </span>
      )}
    </div>
  );
}
