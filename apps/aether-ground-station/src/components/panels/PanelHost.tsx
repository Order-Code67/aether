import type { PanelKind } from "@/types";
import { ModuleErrorBoundary } from "@/components/common/ModuleErrorBoundary";
import { VideoPanel } from "@/modules/video/VideoPanel";
import { WalksnailPanel } from "@/modules/walksnail/WalksnailPanel";
import { MapPanel } from "@/modules/map/MapPanel";
import { DevicesPanel } from "@/modules/devices/DevicesPanel";
import { TelemetryPanel } from "@/modules/telemetry/TelemetryPanel";
import { SerialPanel } from "@/modules/serial/SerialPanel";
import { NetworkPanel } from "@/modules/network/NetworkPanel";
import { UsbPanel } from "@/modules/usb/UsbPanel";
import { ArchivePanel } from "@/modules/archive/ArchivePanel";
import { EventsMiniPanel } from "@/modules/archive/EventsMiniPanel";

interface PanelHostProps {
  kind: PanelKind;
}

function Inner({ kind }: PanelHostProps) {
  switch (kind) {
    case "video":
      return <VideoPanel />;
    case "walksnail":
      return <WalksnailPanel />;
    case "map":
      return <MapPanel />;
    case "devices":
      return <DevicesPanel />;
    case "telemetry":
      return <TelemetryPanel />;
    case "serial":
      return <SerialPanel />;
    case "network":
      return <NetworkPanel />;
    case "usb":
      return <UsbPanel />;
    case "archive":
      return <ArchivePanel />;
    case "events":
      return <EventsMiniPanel />;
    case "empty":
    default:
      return (
        <div className="flex h-full items-center justify-center p-4 text-sm text-ags-muted">
          Пустая панель. Выберите шаблон или модуль в навигации.
        </div>
      );
  }
}

export function PanelHost({ kind }: PanelHostProps) {
  return (
    <ModuleErrorBoundary name={`Панель:${kind}`}>
      <Inner kind={kind} />
    </ModuleErrorBoundary>
  );
}
