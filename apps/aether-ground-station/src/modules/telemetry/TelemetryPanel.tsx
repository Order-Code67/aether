import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { isTauriRuntime } from "@/services/tauri";
import { eventBus } from "@/services/events/eventBus";
import {
  exportTelemetryCsv,
  normalizeTelemetryLine,
  type NormalizedTelemetry,
  type TelemetrySample,
} from "@/services/telemetry/normalize";

/**
 * Телеметрия через адаптеры нормализации — UI не знает wire-формат производителя.
 */
export function TelemetryPanel() {
  const [latest, setLatest] = useState<NormalizedTelemetry | null>(null);
  const [history, setHistory] = useState<TelemetrySample[]>([]);
  const [rawErrors, setRawErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let unlisten: (() => void) | undefined;
    void (async () => {
      unlisten = await listen<{ data: string }>("serial-data", (ev) => {
        const line = ev.payload.data.trim();
        if (!line.startsWith("{")) return;
        const msg = normalizeTelemetryLine(line);
        if (!msg) {
          setRawErrors((prev) =>
            [`Некорректный кадр: ${line.slice(0, 80)}`, ...prev].slice(0, 20),
          );
          return;
        }
        setLatest(msg);
        setHistory((prev) =>
          [
            {
              at: msg.receivedAt,
              voltageV: msg.voltageV,
              temperatureC: msg.temperatureC,
            },
            ...prev,
          ].slice(0, 200),
        );
        eventBus.emit(
          "info",
          "telemetry",
          `${msg.deviceLabel} · ${msg.rawStatus}`,
        );
        for (const w of msg.warnings) {
          if (w.startsWith("Статус:")) {
            eventBus.emit("warning", "telemetry", w);
          }
        }
      });
    })();
    return () => unlisten?.();
  }, []);

  const spark = useMemo(() => {
    const vals = history
      .map((h) => h.temperatureC)
      .filter((v): v is number => v != null)
      .slice(0, 40)
      .reverse();
    if (vals.length < 2) return null;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    const w = 160;
    const h = 36;
    const pts = vals
      .map((v, i) => {
        const x = (i / (vals.length - 1)) * w;
        const y = h - ((v - min) / span) * h;
        return `${x},${y}`;
      })
      .join(" ");
    return { pts, w, h, min, max };
  }, [history]);

  const exportCsv = () => {
    const csv = exportTelemetryCsv(history);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ags-telemetry-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    eventBus.emit("info", "telemetry", "Экспорт CSV");
  };

  return (
    <div className="flex h-full flex-col gap-3 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ags-muted">
          Нормализованная диагностика через адаптеры (ESP32 JSON / generic).
          Поля без датчика — «нет данных», без подстановки фиктивных значений.
        </p>
        <button
          type="button"
          disabled={history.length === 0}
          className="rounded border border-ags-border px-2 py-1 text-xs disabled:opacity-40"
          onClick={exportCsv}
        >
          Экспорт CSV
        </button>
      </div>
      {!latest ? (
        <div className="rounded border border-dashed border-ags-border p-4 text-ags-dim">
          Нет телеметрии. Подключите контроллер в модуле COM и отправьте JSON.
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 rounded border border-ags-border bg-ags-elevated p-3">
            <dt className="text-ags-dim">Устройство</dt>
            <dd>{latest.deviceLabel}</dd>
            <dt className="text-ags-dim">Прошивка</dt>
            <dd>{latest.firmware || "—"}</dd>
            <dt className="text-ags-dim">Online</dt>
            <dd>{latest.online ? "да" : "нет"}</dd>
            <dt className="text-ags-dim">Напряжение</dt>
            <dd>
              {latest.voltageV === null
                ? "нет данных"
                : `${latest.voltageV} В`}
            </dd>
            <dt className="text-ags-dim">Температура</dt>
            <dd>
              {latest.temperatureC === null
                ? "нет данных"
                : `${latest.temperatureC} °C`}
            </dd>
          </dl>
          {latest.warnings.length > 0 && (
            <ul className="text-xs text-ags-warning">
              {latest.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          {spark && (
            <div className="rounded border border-ags-border bg-ags-elevated p-2">
              <div className="mb-1 text-[11px] uppercase tracking-wide text-ags-dim">
                История T° ({spark.min.toFixed(1)}…{spark.max.toFixed(1)})
              </div>
              <svg width={spark.w} height={spark.h} className="text-ags-accent">
                <polyline
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  points={spark.pts}
                />
              </svg>
              <div className="text-[11px] text-ags-dim">
                Точек в буфере: {history.length}
              </div>
            </div>
          )}
        </>
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
