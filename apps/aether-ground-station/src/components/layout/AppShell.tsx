import { NavRail } from "./NavRail";
import { TopBar } from "./TopBar";
import { WorkArea } from "./WorkArea";
import { DeviceRail } from "./DeviceRail";
import { EventLogPanel } from "./EventLogPanel";
import { StatusBar } from "./StatusBar";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function AppShell() {
  const eventLogVisible = useWorkspaceStore((s) => s.active().eventLogVisible);
  const deviceRailVisible = useWorkspaceStore((s) => s.active().deviceRailVisible);

  return (
    <div className="flex h-full w-full flex-col bg-ags-bg text-ags-fg">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <NavRail />
        <div className="flex min-w-0 flex-1 flex-col">
          <WorkArea />
          {eventLogVisible && <EventLogPanel />}
        </div>
        {deviceRailVisible && <DeviceRail />}
      </div>
      <StatusBar />
    </div>
  );
}
