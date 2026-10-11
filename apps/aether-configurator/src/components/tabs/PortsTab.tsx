import { useEffect } from "react";
import { RefreshCw, Save } from "lucide-react";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/hooks/useI18n";
import { useConnectionStore } from "@/stores/connectionStore";
import { usePortsStore } from "@/stores/portsStore";
import {
  SERIAL_FUNCTION_BITS,
  serialFunctionLabels,
  serialIdentifierLabel,
} from "@/core/protocols/msp/ports";

export function PortsTab() {
  const { t } = useI18n();
  const connected = useConnectionStore((s) => s.connected);
  const ports = usePortsStore((s) => s.ports);
  const source = usePortsStore((s) => s.source);
  const busy = usePortsStore((s) => s.busy);
  const dirty = usePortsStore((s) => s.dirty);
  const notice = usePortsStore((s) => s.notice);
  const error = usePortsStore((s) => s.error);
  const load = usePortsStore((s) => s.load);
  const write = usePortsStore((s) => s.write);
  const toggleBit = usePortsStore((s) => s.toggleBit);

  useEffect(() => {
    if (connected) void load();
  }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps

  const banner =
    error === "NOT_CONNECTED"
      ? t("ports.needConnect")
      : error === "PORTS_NO_DATA"
        ? t("ports.err.empty")
        : error === "ARMED"
          ? t("ports.err.armed")
          : error
            ? error
            : notice === "PORTS_LOADED_MSP"
              ? t("ports.loadedMsp")
              : notice === "PORTS_LOADED_CLI"
                ? t("ports.loadedCli")
                : notice === "PORTS_WRITTEN"
                  ? t("ports.written")
                  : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">{t("ports.title")}</h2>
          <p className="mt-1 max-w-2xl text-sm text-fg-muted">{t("ports.hint")}</p>
        </div>
        <div className="flex gap-2">
          {dirty && <Badge tone="warn">{t("ports.dirty")}</Badge>}
          <Badge tone="neutral">{source}</Badge>
          <Button variant="secondary" disabled={!connected || busy} onClick={() => void load()}>
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
            {t("ports.load")}
          </Button>
          <Button
            variant="primary"
            disabled={!connected || busy || ports.length === 0}
            onClick={() => {
              if (!window.confirm(t("ports.confirm"))) return;
              void write();
            }}
          >
            <Save className="h-3.5 w-3.5" />
            {t("ports.write")}
          </Button>
        </div>
      </div>

      {banner && (
        <Card className={error ? "border-danger/40" : "border-ok/40"}>
          <p className={`text-sm ${error ? "text-danger" : "text-ok"}`}>{banner}</p>
        </Card>
      )}

      <div className="space-y-3">
        {ports.map((p, idx) => (
          <Card key={`${p.identifier}-${idx}`}>
            <CardTitle>
              {serialIdentifierLabel(p.identifier)}{" "}
              <span className="font-normal text-fg-muted">
                ({serialFunctionLabels(p.functionMask).join(", ")})
              </span>
            </CardTitle>
            <CardHint>
              MSP {p.mspBaud} · GPS {p.gpsBaud} · TLM {p.telemetryBaud} · BB{" "}
              {p.blackboxBaud}
            </CardHint>
            <div className="mt-3 flex flex-wrap gap-2">
              {SERIAL_FUNCTION_BITS.map((f) => {
                const on = (p.functionMask & (1 << f.bit)) !== 0;
                return (
                  <label
                    key={f.id}
                    className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px]"
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => toggleBit(idx, f.bit, e.target.checked)}
                    />
                    {f.id}
                  </label>
                );
              })}
            </div>
          </Card>
        ))}
        {ports.length === 0 && (
          <Card>
            <p className="text-sm text-fg-muted">{t("ports.empty")}</p>
          </Card>
        )}
      </div>
    </div>
  );
}
