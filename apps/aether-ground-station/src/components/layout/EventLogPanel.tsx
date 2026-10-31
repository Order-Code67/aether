import { useEventLogStore } from "@/stores/eventLogStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { EventSeverity } from "@/types";
import { PanelChrome } from "@/components/common/PanelChrome";

const TONE: Record<EventSeverity, string> = {
  debug: "text-ags-dim",
  info: "text-ags-muted",
  warning: "text-ags-warning",
  error: "text-ags-danger",
};

export function EventLogPanel() {
  const events = useEventLogStore((s) => s.events);
  const clear = useEventLogStore((s) => s.clear);
  const height = useWorkspaceStore((s) => s.active().eventLogHeight);
  const setHeight = useWorkspaceStore((s) => s.setEventLogHeight);

  return (
    <div className="relative shrink-0" style={{ height }}>
      <div
        className="absolute inset-x-0 top-0 z-10 h-1.5 cursor-row-resize bg-transparent hover:bg-ags-accent/40"
        onMouseDown={(e) => {
          e.preventDefault();
          const startY = e.clientY;
          const startH = height;
          const onMove = (ev: MouseEvent) => {
            setHeight(startH - (ev.clientY - startY));
          };
          const onUp = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
          };
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        }}
      />
      <PanelChrome
        title="Журнал событий"
        className="h-full rounded-none border-x-0 border-b-0"
        actions={
          <button
            type="button"
            onClick={clear}
            className="text-[11px] text-ags-dim hover:text-ags-fg"
          >
            Очистить
          </button>
        }
      >
        <div className="h-full overflow-auto px-3 py-2 font-mono text-xs">
          {events.length === 0 ? (
            <p className="text-ags-dim">Событий пока нет.</p>
          ) : (
            <ul className="space-y-1">
              {events.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="shrink-0 text-ags-dim">
                    {new Date(e.at).toLocaleTimeString()}
                  </span>
                  <span className={`shrink-0 uppercase ${TONE[e.severity]}`}>
                    {e.severity}
                  </span>
                  <span className="shrink-0 text-ags-accent">{e.source}</span>
                  <span className="text-ags-fg">{e.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PanelChrome>
    </div>
  );
}
