import { useDeviceStore } from "@/stores/deviceStore";
import { StatusBadge } from "@/components/common/StatusBadge";
import type { DeviceStatus } from "@/types";

function tone(status: DeviceStatus): "neutral" | "ok" | "warn" | "danger" {
  switch (status) {
    case "Online":
      return "ok";
    case "Connecting":
    case "Warning":
    case "Lost":
      return "warn";
    case "Error":
      return "danger";
    default:
      return "neutral";
  }
}

export function DevicesPanel() {
  const devices = useDeviceStore((s) => s.devices);

  if (devices.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-ags-muted">
        Нет устройств. Обнаружение выполняется в модулях USB / COM / Сеть /
        Видео по разрешению пользователя.
      </div>
    );
  }

  return (
    <div className="grid gap-2 overflow-auto p-3 sm:grid-cols-2">
      {devices.map((d) => (
        <article
          key={d.id}
          className="rounded border border-ags-border bg-ags-elevated p-3 text-sm"
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <h4 className="font-semibold text-ags-fg">{d.name}</h4>
            <StatusBadge label={d.status} tone={tone(d.status)} />
          </div>
          <dl className="grid grid-cols-[7rem_1fr] gap-y-1 text-xs">
            <dt className="text-ags-dim">Производитель</dt>
            <dd>{d.manufacturer ?? "—"}</dd>
            <dt className="text-ags-dim">Модель</dt>
            <dd>{d.model ?? "—"}</dd>
            <dt className="text-ags-dim">Подключение</dt>
            <dd>{d.connectionType}</dd>
            <dt className="text-ags-dim">Адрес</dt>
            <dd className="font-mono">{d.address ?? "—"}</dd>
            <dt className="text-ags-dim">Прошивка</dt>
            <dd>{d.firmwareVersion ?? "—"}</dd>
            <dt className="text-ags-dim">Контакт</dt>
            <dd>
              {d.lastSeenAt
                ? new Date(d.lastSeenAt).toLocaleString()
                : "—"}
            </dd>
            <dt className="text-ags-dim">Возможности</dt>
            <dd>{d.capabilities.join(", ") || "—"}</dd>
          </dl>
        </article>
      ))}
    </div>
  );
}
