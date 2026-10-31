import { useState } from "react";
import { listUsbDevices } from "@/services/hardware";
import type { UsbDeviceInfo } from "@/types";
import { eventBus } from "@/services/events/eventBus";
import { isTauriRuntime } from "@/services/tauri";
import { useDeviceStore } from "@/stores/deviceStore";

export function UsbPanel() {
  const [allowed, setAllowed] = useState(false);
  const [devices, setDevices] = useState<UsbDeviceInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const upsert = useDeviceStore((s) => s.upsert);

  const refresh = async () => {
    if (!isTauriRuntime()) {
      setError("Список USB доступен только в desktop-сборке");
      return;
    }
    try {
      const list = await listUsbDevices();
      setDevices(list);
      setError(null);
      for (const d of list) {
        upsert({
          id: d.id,
          name: d.product ?? `USB ${d.vendorId.toString(16)}:${d.productId.toString(16)}`,
          manufacturer: d.manufacturer,
          model: d.product,
          connectionType: "usb",
          address: d.serialNumber,
          status: "Online",
          lastSeenAt: new Date().toISOString(),
          capabilities: ["usb"],
        });
      }
      eventBus.emit("info", "usb", `USB-устройств: ${list.length}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="flex h-full flex-col gap-2 p-3 text-sm">
      {!allowed ? (
        <div className="rounded border border-ags-border bg-ags-elevated p-3 text-ags-muted">
          <p className="mb-2">
            Перечисление USB выполняется только после вашего разрешения. Чужие
            устройства не подключаются автоматически.
          </p>
          <button
            type="button"
            className="rounded bg-ags-accent px-3 py-1 text-white"
            onClick={() => {
              setAllowed(true);
              void refresh();
            }}
          >
            Разрешить список USB
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => void refresh()}
            className="w-fit rounded border border-ags-border px-2 py-1 text-xs"
          >
            Обновить
          </button>
          {error && <p className="text-xs text-ags-danger">{error}</p>}
          {devices.length === 0 ? (
            <p className="text-ags-muted">Устройства не найдены.</p>
          ) : (
            <ul className="space-y-2 overflow-auto">
              {devices.map((d) => (
                <li
                  key={d.id}
                  className="rounded border border-ags-border bg-ags-elevated px-3 py-2"
                >
                  <div className="font-medium">
                    {d.product ?? "Без названия"}
                  </div>
                  <div className="text-xs text-ags-dim">
                    {d.manufacturer ?? "Производитель неизвестен"} · VID{" "}
                    {d.vendorId.toString(16).padStart(4, "0")} PID{" "}
                    {d.productId.toString(16).padStart(4, "0")}
                  </div>
                  {d.serialNumber && (
                    <div className="font-mono text-[11px] text-ags-muted">
                      S/N: {d.serialNumber}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
