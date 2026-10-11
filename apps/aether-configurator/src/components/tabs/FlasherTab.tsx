import { useEffect, useState } from "react";
import { Cpu, FolderOpen, Zap } from "lucide-react";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/hooks/useI18n";
import { useConnectionStore } from "@/stores/connectionStore";

export function FlasherTab() {
  const { t } = useI18n();
  const disconnect = useConnectionStore((s) => s.disconnect);
  const [tool, setTool] = useState<{
    installed: boolean;
    path: string | null;
    version: string | null;
  } | null>(null);
  const [devices, setDevices] = useState<string[]>([]);
  const [hexPath, setHexPath] = useState("");
  const [log, setLog] = useState("");
  const [flashing, setFlashing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void window.aether?.dfu.detect().then(setTool);
    const offOut = window.aether?.dfu.onOutput((p) => {
      setLog((prev) => (prev + p.line).slice(-20000));
    });
    const offStatus = window.aether?.dfu.onStatus((s) => {
      setFlashing(s.running);
      if (!s.running && s.error) setError(s.error);
      if (!s.running && s.success) setError(null);
    });
    return () => {
      offOut?.();
      offStatus?.();
    };
  }, []);

  async function onDetect() {
    setError(null);
    const info = await window.aether?.dfu.detect();
    if (info) setTool(info);
    const list = await window.aether?.dfu.list();
    setDevices(list?.devices ?? []);
    if (list?.error) setError(list.error);
  }

  async function onPick() {
    const path = await window.aether?.app.openFile({
      title: t("flasher.pick"),
      filters: [
        { name: "Firmware", extensions: ["hex", "bin"] },
        { name: "All", extensions: ["*"] },
      ],
    });
    if (path) setHexPath(path);
  }

  async function onFlash() {
    if (!hexPath) {
      setError("NEED_HEX");
      return;
    }
    if (!window.confirm(t("flasher.confirm"))) return;
    setError(null);
    setLog("");
    setFlashing(true);
    try {
      await disconnect();
      await window.aether?.dfu.flash(hexPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : "DFU_FLASH_FAILED");
      setFlashing(false);
    }
  }

  const errText =
    error === "DFU_UTIL_MISSING"
      ? t("flasher.toolMissing")
      : error === "NEED_HEX"
        ? t("flasher.needHex")
        : error === "DFU_FLASH_FAILED"
          ? t("flasher.failed")
          : error;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-semibold">{t("flasher.title")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-fg-muted">{t("flasher.hint")}</p>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Cpu className="h-4 w-4 text-accent" />
          <CardTitle>dfu-util</CardTitle>
          <Badge tone={tool?.installed ? "ok" : "warn"}>
            {tool?.installed
              ? tool.version ?? "ok"
              : t("flasher.toolMissingShort")}
          </Badge>
        </div>
        <CardHint className="mt-1">{tool?.path ?? t("flasher.installHint")}</CardHint>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void onDetect()} disabled={flashing}>
            {t("flasher.detect")}
          </Button>
          <Button variant="secondary" onClick={() => void onPick()} disabled={flashing}>
            <FolderOpen className="h-3.5 w-3.5" />
            {t("flasher.pick")}
          </Button>
          <Button
            variant="primary"
            onClick={() => void onFlash()}
            disabled={flashing || !hexPath}
          >
            <Zap className="h-3.5 w-3.5" />
            {flashing ? t("flasher.flashing") : t("flasher.flash")}
          </Button>
        </div>
        {hexPath && (
          <p className="mt-2 truncate font-mono text-[11px] text-fg-muted">
            {hexPath}
          </p>
        )}
      </Card>

      {errText && (
        <Card className="border-danger/40">
          <p className="text-sm text-danger">{errText}</p>
        </Card>
      )}

      <Card>
        <CardTitle>{t("flasher.devices")}</CardTitle>
        {devices.length === 0 ? (
          <p className="mt-2 text-xs text-fg-muted">{t("flasher.noDevices")}</p>
        ) : (
          <ul className="mt-2 space-y-1 font-mono text-[11px]">
            {devices.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle>{t("flasher.log")}</CardTitle>
        <pre className="mt-2 max-h-64 overflow-auto rounded border border-border bg-[#071018] p-2 font-mono text-[11px] text-[#c8e6c9]">
          {log || "—"}
        </pre>
      </Card>
    </div>
  );
}
