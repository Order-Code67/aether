import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  parseDiagnosticsMessage,
  type DiagnosticsMessage,
} from "@/types";
import { isTauriRuntime } from "@/services/tauri";
import { eventBus } from "@/services/events/eventBus";

/**
 * Документированный JSON-протокол:
 * { "device": "ESP32", "version": "1.0.0", "status": "online", "voltage": null, "temperature": null }
 * null остаётся null — UI не подставляет вымышленные значения.
 */
export function TelemetryPanel() {
  const [latest, setLatest] = useState<DiagnosticsMessage | null>(null);
  const [rawErrors, setRawErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let unlisten: (() => void) | undefined;
    void (async () => {
      unlisten = await listen<{ data: string }>("serial-data", (ev) => {
        const line = ev.payload.data.trim();
        if (!line.startsWith("{")) return;
        const msg = parseDiagnosticsMessage(line);
        if (!msg) {
          setRawErrors((prev) =>
            [`Некорректный JSON: ${line.slice(0, 80)}`, ...prev].slice(0, 20),
          );
          return;
        }
        setLatest(msg);
        eventBus.emit("info", "telemetry", `${msg.device} · ${msg.status}`);
      });
    })();
    return () => unlisten?.();
  }, []);

  return (
    <div className="flex h-full flex-col gap-3 p-3 text-sm">
      <p className="text-xs text-ags-muted">
        Диагностика ESP32 / Arduino по JSON-протоколу через открытый COM-порт.
        Поля без датчика отображаются как «нет данных».
      </p>
      {!latest ? (
        <div className="rounded border border-dashed border-ags-border p-4 text-ags-dim">
          Нет телеметрии. Подключите контроллер в модуле COM и отправьте JSON.
        </div>
      ) : (
        <dl className="grid grid-cols-[8rem_1fr] gap-y-2 rounded border border-ags-border bg-ags-elevated p-3">
          <dt className="text-ags-dim">Устройство</dt>
          <dd>{latest.device}</dd>
          <dt className="text-ags-dim">Версия</dt>
          <dd>{latest.version}</dd>
          <dt className="text-ags-dim">Статус</dt>
          <dd>{latest.status}</dd>
          <dt className="text-ags-dim">Напряжение</dt>
          <dd>
            {latest.voltage === null ? "нет данных" : `${latest.voltage} В`}
          </dd>
          <dt className="text-ags-dim">Температура</dt>
          <dd>
            {latest.temperature === null
              ? "нет данных"
              : `${latest.temperature} °C`}
          </dd>
        </dl>
      )}
      {rawErrors.length > 0 && (
        <div className="text-xs text-ags-warning">
          {rawErrors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}
    </div>
  );
}
