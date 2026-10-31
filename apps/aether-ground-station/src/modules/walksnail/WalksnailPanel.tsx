import { useState } from "react";
import { VideoPanel } from "@/modules/video/VideoPanel";
import type { WalksnailOutputMode } from "@/types";
import { eventBus } from "@/services/events/eventBus";

/**
 * Walksnail adapter: способ вывода задаётся явно.
 * Сам по себе VRX не считается универсальным — только через выбранный захват.
 */
export function WalksnailPanel() {
  const [mode, setMode] = useState<WalksnailOutputMode>("unspecified");
  const [name, setName] = useState("Walksnail VRX");

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-ags-border-subtle p-3 text-xs">
        <p className="text-ags-muted">
          Адаптер Walksnail. Интерфейс вывода у разных VRX отличается — укажите
          способ подключения для этого устройства.
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
            onChange={(e) => {
              const next = e.target.value as WalksnailOutputMode;
              setMode(next);
              eventBus.emit(
                "info",
                "walksnail",
                `Режим вывода: ${next} (${name})`,
              );
            }}
          >
            <option value="unspecified">Не задан</option>
            <option value="hdmi-capture">HDMI → устройство захвата</option>
            <option value="usb-capture">USB-захват</option>
          </select>
        </div>
        {mode === "unspecified" && (
          <p className="text-ags-warning">
            Задайте способ подключения, прежде чем считать сигнал Walksnail
            доступным.
          </p>
        )}
      </div>
      {mode === "unspecified" ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-ags-muted">
          Видеопоток не запускается без выбранного интерфейса вывода. Фиктивный
          сигнал не используется.
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <VideoPanel />
        </div>
      )}
    </div>
  );
}
