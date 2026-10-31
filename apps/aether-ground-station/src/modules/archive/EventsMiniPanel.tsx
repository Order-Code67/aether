import { useEventLogStore } from "@/stores/eventLogStore";

export function EventsMiniPanel() {
  const events = useEventLogStore((s) => s.events).slice(0, 50);
  return (
    <div className="h-full overflow-auto p-2 font-mono text-[11px]">
      {events.map((e) => (
        <div key={e.id} className="text-ags-muted">
          <span className="text-ags-dim">
            {new Date(e.at).toLocaleTimeString()}
          </span>{" "}
          [{e.severity}] {e.source}: {e.message}
        </div>
      ))}
    </div>
  );
}
