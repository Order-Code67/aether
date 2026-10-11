import { useEffect } from "react";
import { RefreshCw, Unplug, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/hooks/useI18n";
import {
  BAUD_RATE_OPTIONS,
  useConnectionStore,
} from "@/stores/connectionStore";
import { CRAFT_OPTIONS, useCraftStore } from "@/stores/craftStore";

export function ConnectionBar() {
  const { t } = useI18n();
  const mode = useConnectionStore((s) => s.mode);
  const protocol = useConnectionStore((s) => s.protocol);
  const ports = useConnectionStore((s) => s.ports);
  const selectedPort = useConnectionStore((s) => s.selectedPort);
  const baudRate = useConnectionStore((s) => s.baudRate);
  const host = useConnectionStore((s) => s.host);
  const netPort = useConnectionStore((s) => s.netPort);
  const connected = useConnectionStore((s) => s.connected);
  const connecting = useConnectionStore((s) => s.connecting);
  const label = useConnectionStore((s) => s.label);
  const error = useConnectionStore((s) => s.error);
  const polling = useConnectionStore((s) => s.polling);

  const setMode = useConnectionStore((s) => s.setMode);
  const setProtocol = useConnectionStore((s) => s.setProtocol);
  const setSelectedPort = useConnectionStore((s) => s.setSelectedPort);
  const setBaudRate = useConnectionStore((s) => s.setBaudRate);
  const setHost = useConnectionStore((s) => s.setHost);
  const setNetPort = useConnectionStore((s) => s.setNetPort);
  const refreshPorts = useConnectionStore((s) => s.refreshPorts);
  const connect = useConnectionStore((s) => s.connect);
  const disconnect = useConnectionStore((s) => s.disconnect);
  const pollStatus = useConnectionStore((s) => s.pollStatus);
  const craft = useCraftStore((s) => s.kind);
  const setCraft = useCraftStore((s) => s.setCraft);

  useEffect(() => {
    void refreshPorts();
    const id = window.setInterval(() => {
      if (!useConnectionStore.getState().connected) void refreshPorts();
    }, 4000);
    return () => window.clearInterval(id);
  }, [refreshPorts]);

  const portInList = ports.some(
    (p) => p.path.toUpperCase() === selectedPort.trim().toUpperCase(),
  );

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface/70 px-3 py-2 backdrop-blur">
      <Select
        className="w-[130px]"
        value={mode}
        onChange={(e) =>
          setMode(e.target.value as "serial" | "tcp" | "udp")
        }
        disabled={connected}
      >
        <option value="serial">{t("connection.mode.serial")}</option>
        <option value="tcp">{t("connection.mode.tcp")}</option>
        <option value="udp">{t("connection.mode.udp")}</option>
      </Select>

      <Select
        className="w-[110px]"
        value={protocol}
        onChange={(e) =>
          setProtocol(e.target.value as "msp" | "mavlink" | "auto")
        }
        disabled={connected}
        aria-label={t("connection.protocol")}
      >
        <option value="msp">{t("connection.protocol.msp")}</option>
        <option value="mavlink">{t("connection.protocol.mavlink")}</option>
        <option value="auto">{t("connection.protocol.auto")}</option>
      </Select>

      <Select
        className="w-[120px]"
        value={craft}
        onChange={(e) => setCraft(e.target.value as typeof craft)}
        aria-label={t("craft.label")}
      >
        {CRAFT_OPTIONS.map((c) => (
          <option key={c.kind} value={c.kind}>
            {c.label}
          </option>
        ))}
      </Select>

      {mode === "serial" ? (
        <>
          <Select
            className="min-w-[200px] flex-1"
            value={portInList ? selectedPort.toUpperCase() : ""}
            onChange={(e) => setSelectedPort(e.target.value)}
            disabled={connected}
          >
            <option value="">{t("connection.pickPort")}</option>
            {ports.map((p) => (
              <option key={p.path} value={p.path}>
                {p.name}
                {p.portType === "phantom" ? ` — ${t("connection.phantom")}` : ""}
              </option>
            ))}
          </Select>
          <Input
            className="w-[100px] font-mono uppercase"
            value={selectedPort}
            onChange={(e) => setSelectedPort(e.target.value.toUpperCase())}
            disabled={connected}
            placeholder="COM4"
            title={t("connection.manualHint")}
            aria-label={t("connection.manual")}
          />
          <Select
            className="w-[110px]"
            value={baudRate}
            onChange={(e) => setBaudRate(Number(e.target.value))}
            disabled={connected}
          >
            {BAUD_RATE_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
          <Button
            variant="ghost"
            onClick={() => void refreshPorts()}
            disabled={connected}
            title={t("connection.refresh")}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </>
      ) : (
        <>
          <Input
            className="w-[160px]"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            disabled={connected}
            placeholder={t("connection.host")}
          />
          <Input
            className="w-[100px]"
            type="number"
            value={netPort}
            onChange={(e) => setNetPort(Number(e.target.value))}
            disabled={connected}
          />
        </>
      )}

      {connected ? (
        <Button variant="danger" onClick={() => void disconnect()}>
          <Unplug className="h-3.5 w-3.5" />
          {t("connection.disconnect")}
        </Button>
      ) : (
        <Button
          variant="primary"
          onClick={() => void connect()}
          disabled={
            connecting ||
            (mode === "serial" && !selectedPort.trim())
          }
        >
          <Plug className="h-3.5 w-3.5" />
          {connecting ? t("connection.connecting") : t("connection.connect")}
        </Button>
      )}

      {connected && protocol !== "mavlink" && (
        <Button
          variant="ghost"
          onClick={() => void pollStatus()}
          disabled={polling}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${polling ? "animate-spin" : ""}`} />
          {t("connection.poll")}
        </Button>
      )}

      <div className="ml-auto flex min-w-0 flex-col items-end gap-0.5">
        {mode === "serial" && ports.length === 0 && !connected && (
          <span className="max-w-[320px] text-right text-[10px] text-warn">
            {t("connection.noPortsHint")}
          </span>
        )}
        {error && (
          <span className="max-w-[320px] truncate text-right text-[11px] text-danger">
            {error === "NO_ELECTRON_BRIDGE" ? t("connection.noBridge") : error}
          </span>
        )}
        <Badge tone={connected ? "ok" : "neutral"}>
          {connected ? label ?? "online" : t("connection.disconnected")}
        </Badge>
      </div>
    </div>
  );
}
