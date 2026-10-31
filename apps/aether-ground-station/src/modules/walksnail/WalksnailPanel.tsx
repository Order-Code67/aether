import { useState } from "react";
import { VideoPanel } from "@/modules/video/VideoPanel";
import type { WalksnailOutputMode } from "@/types";
import { eventBus } from "@/services/events/eventBus";
import { deviceManager } from "@/services/devices/deviceManager";

/**
 * Walksnail adapter: способ вывода задаётся явно.
 * Ошибки: нет устройства / нет сигнала — через Video Capture + статусы Device Manager.
 */
export function WalksnailPanel() {
  const [mode, setMode] = useState<WalksnailOutputMode>("unspecified");
  const [name, setName] = useState("Walksnail VRX");

  const applyMode = (next: WalksnailOutputMode) => {
    setMode(next);
    const id = `walksnail:${name}`;
    if (next === "unspecified") {
      deviceManager.upsert({
        id,
        name,
        connectionType: "capture",
        status: "Offline",
        lastSeenAt: new Date().toISOString(),
        capabilities: ["walksnail", "video"],
      });
      eventBus.emit(
        "warning",
        "walksnail",
        "Режим вывода не задан — захват не запущен",
      );
      return;
    }
    deviceManager.upsert({
      id,
      name,
      connectionType: "capture",
      address: next,
      status: "Connecting",
      lastSeenAt: new Date().toISOString(),
      capabilities: ["walksnail", "video"],
    });
    eventBus.emit("info", "walksnail", `Режим вывода: ${next} (${name})`);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-ags-border-subtle p-3 text-xs">
        <p className="text-ags-muted">
          Адаптер Walksnail. Укажите явный режим вывода VRX — без него поток не
          считается доступным.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            className="rounded border border-ags-border bg-ags-elevated px-2 py-1 text-ags-fg"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название устройства"
          />
          <select
            className="rounded border border-ags-border bg-ags-elevated px-2 py-1 text-ags-fg"
            value={mode}
            onChange={(e) =>
              applyMode(e.target.value as WalksnailOutputMode)
            }
          >
            <option value="unspecified">Не задан</option>
            <option value="hdmi-capture">HDMI → устройство захвата</option>
            <option value="usb-capture">USB-захват</option>
          </select>
        </div>
        {mode === "unspecified" && (
          <p className="text-ags-warning">
            Нет устройства: задайте способ подключения (HDMI/USB capture).
          </p>
        )}
        {mode !== "unspecified" && (
          <p className="text-ags-dim">
            Если кадры не появляются — «нет сигнала» от захвата (чёрный кадр /
            устройство без входа). Фиктивный сигнал не подставляется.
          </p>
        )}
      </div>
      {mode === "unspecified" ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-ags-muted">
          <div>
            <div className="mb-1 font-medium text-ags-fg">Нет устройства</div>
            Выберите HDMI → захват или USB-захват, затем подключите источник в
            панели видео.
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <VideoPanel />
        </div>
      )}
    </div>
  );
}
