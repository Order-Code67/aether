import { useState } from "react";
import { listNetworkInterfaces, probeHost } from "@/services/hardware";
import type { HostProbeResult, NetworkInterfaceInfo } from "@/types";
import { eventBus } from "@/services/events/eventBus";
import { isTauriRuntime } from "@/services/tauri";

export function NetworkPanel() {
  const [allowed, setAllowed] = useState(false);
  const [ifaces, setIfaces] = useState<NetworkInterfaceInfo[]>([]);
  const [host, setHost] = useState("");
  const [port, setPort] = useState(80);
  const [probe, setProbe] = useState<HostProbeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!isTauriRuntime()) {
      setError("Сетевые интерфейсы доступны только в desktop-сборке");
      return;
    }
    try {
      const list = await listNetworkInterfaces();
      setIfaces(list);
      setError(null);
      eventBus.emit("info", "network", `Интерфейсов: ${list.length}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const runProbe = async () => {
    if (!host.trim()) return;
    try {
      const result = await probeHost(host.trim(), port);
      setProbe(result);
      eventBus.emit(
        result.ok ? "info" : "warning",
        "network",
        result.ok
          ? `Доступен ${host}:${port} (${result.latencyMs ?? "?"} мс)`
          : `Недоступен ${host}:${port}: ${result.error ?? "ошибка"}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="flex h-full flex-col gap-3 p-3 text-sm">
      {!allowed ? (
        <div className="rounded border border-ags-border bg-ags-elevated p-3 text-ags-muted">
          <p className="mb-2">
            Автосканирование сети не выполняется. Отображение интерфейсов и
            проверка хоста — только по запросу.
          </p>
          <button
            type="button"
            className="rounded bg-ags-accent px-3 py-1 text-white"
            onClick={() => {
              setAllowed(true);
              void refresh();
            }}
          >
            Показать локальные интерфейсы
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => void refresh()}
            className="w-fit rounded border border-ags-border px-2 py-1 text-xs"
          >
            Обновить интерфейсы
          </button>
          {error && <p className="text-xs text-ags-danger">{error}</p>}
          <ul className="space-y-1 text-xs">
            {ifaces.map((i) => (
              <li
                key={`${i.name}-${i.ipv4}`}
                className="rounded border border-ags-border px-2 py-1"
              >
                <span className="text-ags-fg">{i.name}</span>
                <span className="ml-2 font-mono text-ags-muted">
                  {i.ipv4 ?? "без IPv4"}
                </span>
                {i.mac && (
                  <span className="ml-2 font-mono text-ags-dim">{i.mac}</span>
                )}
              </li>
            ))}
          </ul>
          <div className="border-t border-ags-border-subtle pt-3">
            <div className="mb-1 text-xs uppercase tracking-wide text-ags-dim">
              Проверка доступности (TCP)
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                className="flex-1 rounded border border-ags-border bg-ags-elevated px-2 py-1"
                placeholder="IP или хост"
                value={host}
                onChange={(e) => setHost(e.target.value)}
              />
              <input
                type="number"
                className="w-20 rounded border border-ags-border bg-ags-elevated px-2 py-1"
                value={port}
                onChange={(e) => setPort(Number(e.target.value) || 80)}
              />
              <button
                type="button"
                onClick={() => void runProbe()}
                className="rounded bg-ags-accent px-2 py-1 text-white"
              >
                Проверить
              </button>
            </div>
            {probe && (
              <p className="mt-2 text-xs text-ags-muted">
                {probe.ok
                  ? `OK · ${probe.latencyMs ?? "?"} мс`
                  : `Ошибка · ${probe.error ?? "нет ответа"}`}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
