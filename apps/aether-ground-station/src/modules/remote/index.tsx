import { useState } from "react";
import {
  getRemoteGateway,
  getRemoteTestMode,
  setRemoteTestMode,
} from "@/services/remote";
import type { RemoteStationSummary, RemoteTestMode } from "@/types/remote";
import { eventBus } from "@/services/events/eventBus";
import { StatusBadge } from "@/components/common/StatusBadge";

export function RemoteView() {
  const [mode, setMode] = useState<RemoteTestMode>(getRemoteTestMode());
  const [stations, setStations] = useState<RemoteStationSummary[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [synthetic, setSynthetic] = useState(false);

  const applyMode = (next: RemoteTestMode) => {
    setRemoteTestMode(next);
    setMode(next);
    setStations(null);
    setNote(null);
    eventBus.emit("info", "remote", `Режим remote: ${next}`);
  };

  const loadStations = async () => {
    const gw = getRemoteGateway();
    if (!gw) {
      setNote("Remote отключён. Включите sandbox или integration.");
      setStations(null);
      return;
    }
    const res = await gw.registry.listStations();
    setSynthetic(res.meta.synthetic);
    setStations(res.data);
    setNote(
      res.error ??
        (res.meta.synthetic
          ? "Sandbox: список пуст — демо-станции не подставляются"
          : undefined) ??
        null,
    );
  };

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-8">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-ags-dim">Этап v0.3</p>
        <h1 className="mt-2 text-2xl font-semibold">Удалённое подключение</h1>
        <p className="mt-2 max-w-2xl text-sm text-ags-muted">
          Архитектура Remote Connectivity: Client, Gateway, Registry, Auth, Sessions,
          Telemetry, Video Relay, Audit. Реализация сервера — отдельный этап.
          Критические функции безопасности остаются локальными; команды полёта и
          целеуказания через remote не передаются.
        </p>
      </div>

      <section className="max-w-xl space-y-3 rounded-lg border border-ags-border bg-ags-panel p-4 text-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ags-muted">
          Тестовый режим
        </h2>
        <div className="flex flex-wrap gap-2">
          {(["disabled", "sandbox", "integration"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => applyMode(m)}
              className={
                mode === m
                  ? "rounded bg-ags-accent px-3 py-1 text-white"
                  : "rounded border border-ags-border px-3 py-1 text-ags-muted"
              }
            >
              {m}
            </button>
          ))}
        </div>
        <p className="text-xs text-ags-dim">
          Sandbox не выдаёт демонстрационные станции/телеметрию за реальные
          (флаг synthetic=true).
        </p>
        <button
          type="button"
          className="rounded border border-ags-border px-3 py-1.5"
          onClick={() => void loadStations()}
        >
          Запросить список станций (API)
        </button>
        {note && <p className="text-xs text-ags-warning">{note}</p>}
        {stations && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-ags-muted">Станции: {stations.length}</span>
              {synthetic && <StatusBadge label="synthetic" tone="warn" />}
            </div>
            {stations.length === 0 ? (
              <p className="text-ags-dim">Пусто — без фиктивных объектов.</p>
            ) : (
              <ul className="space-y-1">
                {stations.map((s) => (
                  <li key={s.id} className="rounded border border-ags-border px-2 py-1">
                    {s.name} · {s.connectionState}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="max-w-2xl rounded-lg border border-ags-border bg-ags-panel p-4 text-sm text-ags-muted">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider">
          Контракты API
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-xs">
          <li>
            <code className="text-ags-accent">src/types/remote.ts</code> — типы
          </li>
          <li>
            <code className="text-ags-accent">src/services/remote/</code> — интерфейсы
            сервисов + sandbox gateway
          </li>
          <li>
            Документация:{" "}
            <code className="text-ags-accent">docs/REMOTE_CONNECTIVITY.md</code>
          </li>
        </ul>
      </section>
    </div>
  );
}
