import { useDeviceStore } from "@/stores/deviceStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { PanelChrome } from "@/components/common/PanelChrome";
import { StatusBadge } from "@/components/common/StatusBadge";
import type { DeviceStatus } from "@/types";

function tone(status: DeviceStatus): "neutral" | "ok" | "warn" | "danger" {
  switch (status) {
    case "Online":
      return "ok";
    case "Connecting":
    case "Warning":
      return "warn";
    case "Error":
      return "danger";
    default:
      return "neutral";
  }
}

export function DeviceRail() {
  const devices = useDeviceStore((s) => s.devices);
  const width = useWorkspaceStore((s) => s.active().deviceRailWidth);
  const setWidth = useWorkspaceStore((s) => s.setDeviceRailWidth);

  return (
    <aside className="relative flex shrink-0 flex-col" style={{ width }}>
      <div
        className="absolute inset-y-0 left-0 z-10 w-1.5 cursor-col-resize hover:bg-ags-accent/40"
        onMouseDown={(e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startW = width;
          const onMove = (ev: MouseEvent) => {
            setWidth(startW - (ev.clientX - startX));
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
        title="Оборудование"
        className="h-full rounded-none border-y-0 border-r-0"
      >
        <div className="space-y-2 p-3 text-sm">
          {devices.length === 0 ? (
            <p className="leading-relaxed text-ags-muted">
              Устройства появятся после обнаружения через Connection Manager.
              Список пуст — фиктивные записи не создаются.
            </p>
          ) : (
            devices.map((d) => (
              <div
                key={d.id}
                className="rounded border border-ags-border bg-ags-elevated px-3 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-ags-fg">{d.name}</div>
                    <div className="text-xs text-ags-dim">
                      {[d.manufacturer, d.model].filter(Boolean).join(" · ") ||
                        d.connectionType}
                    </div>
                  </div>
                  <StatusBadge label={d.status} tone={tone(d.status)} />
                </div>
                {d.address && (
                  <div className="mt-1 font-mono text-[11px] text-ags-muted">
                    {d.address}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </PanelChrome>
    </aside>
  );
}
