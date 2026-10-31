import type { ComponentType } from "react";
import { MODULES, type ModuleId } from "@/types";
import { useNavigationStore } from "@/stores/navigationStore";
import { WorkspaceView } from "@/modules/workspace";
import { VideoView } from "@/modules/video";
import { WalksnailView } from "@/modules/walksnail";
import { MapView } from "@/modules/map";
import { DevicesView } from "@/modules/devices";
import { NetworkView } from "@/modules/network";
import { UsbView } from "@/modules/usb";
import { SerialView } from "@/modules/serial";
import { TelemetryView } from "@/modules/telemetry";
import { ArchiveView } from "@/modules/archive";
import { ProfilesView } from "@/modules/profiles";
import { RemoteView } from "@/modules/remote";
import { SettingsView } from "@/modules/settings";

const VIEWS: Record<ModuleId, ComponentType> = {
  workspace: WorkspaceView,
  video: VideoView,
  walksnail: WalksnailView,
  map: MapView,
  devices: DevicesView,
  network: NetworkView,
  usb: UsbView,
  serial: SerialView,
  telemetry: TelemetryView,
  archive: ArchiveView,
  profiles: ProfilesView,
  remote: RemoteView,
  settings: SettingsView,
};

export function WorkArea() {
  const activeModule = useNavigationStore((s) => s.activeModule);
  const View = VIEWS[activeModule];
  const def = MODULES.find((m) => m.id === activeModule);

  if (!View || !def) {
    return (
      <main className="flex-1 bg-ags-bg p-6 text-ags-muted">
        Неизвестный модуль
      </main>
    );
  }

  return (
    <main className="min-w-0 flex-1 overflow-auto bg-ags-bg">
      <View />
    </main>
  );
}
