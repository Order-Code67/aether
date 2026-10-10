import { useEffect, useRef, useState } from "react";
import { debugConsoleInput } from "@/lib/debug";
import { useDebugStore } from "@/stores/debugStore";

export function DebugConsole() {
  const lines = useDebugStore((s) => s.consoleLines);
  const sessionActive = useDebugStore((s) => s.sessionActive);
  const clearConsole = useDebugStore((s) => s.clearConsole);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines.length]);

  const submit = async () => {
    const cmd = input.trim();
    if (!cmd || !sessionActive) return;
    setInput("");
    useDebugStore.getState().appendConsole({
      stream: "input",
      text: `❯ ${cmd}\n`,
    });
    try {
      await debugConsoleInput(cmd);
    } catch (error) {
      useDebugStore.getState().appendConsole({
        stream: "error",
        text: `${error instanceof Error ? error.message : "Command failed."}\n`,
      });
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-7 shrink-0 items-center justify-between border-b border-aether-border px-2">
        <span className="text-[11px] text-aether-fg-muted">GDB / MI console</span>
        <button
          type="button"
          onClick={clearConsole}
          className="text-[11px] text-aether-fg-dim hover:text-aether-fg"
        >
          Clear
        </button>
      </div>
      <div className="aether-scroll min-h-0 flex-1 overflow-auto px-2 py-1 font-mono text-[11px] leading-relaxed">
        {lines.length === 0 && (
          <p className="text-aether-fg-dim">
            Debugger output appears here. Start a session from Run and Debug.
          </p>
        )}
        {lines.map((line) => (
          <span
            key={line.id}
            className={
              line.stream === "error" || line.stream === "stderr"
                ? "text-aether-danger"
                : line.stream === "system"
                  ? "text-aether-fg-muted"
                  : line.stream === "input"
                    ? "text-aether-accent"
                    : "text-aether-fg"
            }
          >
            {line.text}
          </span>
        ))}
        <div ref={endRef} />
      </div>
      <form
        className="flex shrink-0 gap-1 border-t border-aether-border p-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input
          value={input}
          disabled={!sessionActive}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            sessionActive
              ? "MI or GDB command (e.g. info registers)"
              : "Start debugging to use the console"
          }
          className="h-7 min-w-0 flex-1 rounded border border-aether-border bg-aether-bg px-2 font-mono text-[11px] text-aether-fg outline-none focus:border-aether-accent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!sessionActive || !input.trim()}
          className="h-7 rounded border border-aether-border px-2 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
