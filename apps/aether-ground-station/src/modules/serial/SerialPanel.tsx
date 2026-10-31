import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  listSerialPorts,
  serialClose,
  serialGetStatus,
  serialOpen,
  serialWrite,
} from "@/services/hardware";
import type { SerialPortInfo, SerialStatus } from "@/types";
import { eventBus } from "@/services/events/eventBus";
import { isTauriRuntime } from "@/services/tauri";
import { useDeviceStore } from "@/stores/deviceStore";

export function SerialPanel() {
  const [ports, setPorts] = useState<SerialPortInfo[]>([]);
  const [path, setPath] = useState("");
  const [baud, setBaud] = useState(115200);
  const [status, setStatus] = useState<SerialStatus>({ connected: false });
  const [log, setLog] = useState<string[]>([]);
  const [tx, setTx] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [allowed, setAllowed] = useState(false);
  const upsert = useDeviceStore((s) => s.upsert);
  const remove = useDeviceStore((s) => s.remove);

  const refresh = async () => {
    if (!isTauriRuntime()) {
      setError("COM-порты доступны только в desktop-сборке");
      return;
    }
    if (!allowed) {
      setError("Сначала разрешите поиск COM-портов");
      return;
    }
    try {
      const list = await listSerialPorts();
      setPorts(list);
      setError(null);
      eventBus.emit("info", "serial", `Найдено портов: ${list.length}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let unlisten: (() => void) | undefined;
    void (async () => {
      unlisten = await listen<{ data: string }>("serial-data", (ev) => {
        setLog((prev) => [`← ${ev.payload.data}`, ...prev].slice(0, 200));
      });
      const st = await serialGetStatus().catch(() => ({ connected: false }));
      setStatus(st);
    })();
    return () => unlisten?.();
  }, []);

  const connect = async () => {
    try {
      await serialOpen(path, baud);
      const st = await serialGetStatus();
      setStatus(st);
      upsert({
        id: `uart:${path}`,
        name: path,
        connectionType: "uart",
        address: `${path} @ ${baud}`,
        status: "Online",
        lastSeenAt: new Date().toISOString(),
        capabilities: ["uart"],
      });
      eventBus.emit("info", "serial", `Подключено: ${path}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      eventBus.emit("error", "serial", msg);
    }
  };

  const disconnect = async () => {
    await serialClose();
    setStatus({ connected: false });
    if (path) remove(`uart:${path}`);
    eventBus.emit("warning", "serial", "Соединение закрыто");
  };

  return (
    <div className="flex h-full flex-col gap-2 p-3 text-sm">
      {!allowed ? (
        <div className="rounded border border-ags-border bg-ags-elevated p-3 text-ags-muted">
          <p className="mb-2">
            Поиск COM-портов выполняется только с вашего разрешения.
          </p>
          <button
            type="button"
            className="rounded bg-ags-accent px-3 py-1 text-white"
            onClick={() => {
              setAllowed(true);
              void refresh();
            }}
          >
            Разрешить поиск портов
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded border border-ags-border px-2 py-1 text-xs"
            >
              Обновить
            </button>
            <select
              className="rounded border border-ags-border bg-ags-elevated px-2 py-1"
              value={path}
              onChange={(e) => setPath(e.target.value)}
            >
              <option value="">Выберите порт</option>
              {ports.map((p) => (
                <option key={p.path} value={p.path}>
                  {p.name} ({p.portType})
                </option>
              ))}
            </select>
            <input
              type="number"
              className="w-28 rounded border border-ags-border bg-ags-elevated px-2 py-1"
              value={baud}
              onChange={(e) => setBaud(Number(e.target.value) || 115200)}
            />
            {status.connected ? (
              <button
                type="button"
                onClick={() => void disconnect()}
                className="rounded border border-ags-danger/50 px-2 py-1 text-ags-danger"
              >
                Отключить
              </button>
            ) : (
              <button
                type="button"
                disabled={!path}
                onClick={() => void connect()}
                className="rounded bg-ags-accent px-2 py-1 text-white disabled:opacity-40"
              >
                Подключить
              </button>
            )}
          </div>
          {error && <p className="text-xs text-ags-danger">{error}</p>}
          <div className="flex gap-2">
            <input
              className="flex-1 rounded border border-ags-border bg-ags-elevated px-2 py-1 font-mono text-xs"
              value={tx}
              onChange={(e) => setTx(e.target.value)}
              placeholder="Отправить строку"
              disabled={!status.connected}
            />
            <button
              type="button"
              disabled={!status.connected || !tx}
              className="rounded border border-ags-border px-2 py-1 disabled:opacity-40"
              onClick={() => void serialWrite(tx + "\n")}
            >
              TX
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto rounded border border-ags-border bg-black/40 p-2 font-mono text-[11px] text-ags-muted">
            {log.length === 0 ? (
              <span className="text-ags-dim">Нет принятых данных</span>
            ) : (
              log.map((line, i) => <div key={`${i}-${line}`}>{line}</div>)
            )}
          </div>
        </>
      )}
    </div>
  );
}
