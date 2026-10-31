import { useEffect, useState } from "react";
import { listNetworkInterfaces, probeHost } from "@/services/hardware";
import type { HostProbeResult, NetworkInterfaceInfo } from "@/types";
import { eventBus } from "@/services/events/eventBus";
import { isTauriRuntime } from "@/services/tauri";
import {
  networkMonitor,
  type MonitoredTarget,
} from "@/services/network/monitor";
import { useDeviceStore } from "@/stores/deviceStore";

export function NetworkPanel() {
  const [allowed, setAllowed] = useState(false);
  const [ifaces, setIfaces] = useState<NetworkInterfaceInfo[]>([]);
  const [host, setHost] = useState("");
  const [port, setPort] = useState(80);
  const [probe, setProbe] = useState<HostProbeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [monitored, setMonitored] = useState<MonitoredTarget[]>([]);
  const upsert = useDeviceStore((s) => s.upsert);

  useEffect(() => networkMonitor.subscribe(setMonitored), []);

  const refresh = async () => {
    if (!isTauriRuntime()) {
      setError("Сетевые интерфейсы доступны только в desktop-сборке");
      return;
    }
    try {
      const list = await listNetworkInterfaces();
      setIfaces(list);
      setError(null);
      for (const i of list) {
        upsert({
          id: `iface:${i.name}`,
          name: i.name,
          connectionType: "ethernet",
          address: i.ipv4,
          status: i.ipv4 ? "Online" : "Offline",
          lastSeenAt: new Date().toISOString(),
          capabilities: ["network-interface"],
        });
      }
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
            Автосканирование чужих сетей не выполняется. Интерфейсы и монитор —
            только для явно указанных хостов.
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
              Network Monitor (latency / loss / reconnect)
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
                className="rounded border border-ags-border px-2 py-1"
              >
                Разовая проверка
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!host.trim()) return;
                  networkMonitor.add(host.trim(), port);
                  eventBus.emit(
                    "info",
                    "network-monitor",
                    `Мониторинг ${host}:${port}`,
                  );
                }}
                className="rounded bg-ags-accent px-2 py-1 text-white"
              >
                Следить
              </button>
            </div>
            {probe && (
              <p className="mt-2 text-xs text-ags-muted">
                {probe.ok
                  ? `OK · ${probe.latencyMs ?? "?"} мс`
                  : `Ошибка · ${probe.error ?? "нет ответа"}`}
              </p>
            )}
            <ul className="mt-3 space-y-2 text-xs">
              {monitored.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-ags-border bg-ags-elevated px-2 py-1.5"
                >
                  <span className="font-mono">
                    {t.host}:{t.port}
                  </span>
                  <span className="text-ags-muted">
                    lat{" "}
                    {t.avgLatencyMs != null
                      ? `${t.avgLatencyMs.toFixed(0)} мс`
                      : "—"}{" "}
                    · loss {(t.lossRatio * 100).toFixed(0)}% · reconnects{" "}
                    {t.reconnects}
                  </span>
                  <button
                    type="button"
                    className="text-ags-danger"
                    onClick={() => networkMonitor.remove(t.id)}
                  >
                    Стоп
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
