import { useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import {
  serialFunctionLabels,
  serialIdentifierLabel,
  type MspSerialPort,
} from "@/lib/mspConfig";
import {
  eepromWriteMsp,
  readSerialPorts,
  writeSerialPorts,
  type PortsSource,
} from "@/lib/mspPortsModes";
import { useSettingsStore } from "@/stores/settingsStore";

interface Props {
  connected: boolean;
  sessionActive: boolean;
}

export function InavPortsCard({ connected, sessionActive }: Props) {
  const { t } = useI18n();
  const flash = useSettingsStore((s) => s.flashNotice);
  const [ports, setPorts] = useState<MspSerialPort[]>([]);
  const [baseline, setBaseline] = useState<MspSerialPort[]>([]);
  const [source, setSource] = useState<PortsSource>("none");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const live = connected && sessionActive;

  const onRefresh = async () => {
    if (!live) {
      flash(t("inav.msp.needConnect"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await readSerialPorts();
      setPorts(result.ports);
      setBaseline(result.ports.map((p) => ({ ...p })));
      setSource(result.source);
      setNotice(result.notice ?? null);
      if (result.error) setError(result.error);
      else flash(t("inav.ports.loaded", { count: String(result.ports.length) }));
    } finally {
      setBusy(false);
    }
  };

  const updateMask = (idx: number, mask: number) => {
    setPorts((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, functionMask: mask } : p)),
    );
  };

  const onWrite = async () => {
    if (!live || ports.length === 0) return;
    if (!window.confirm(t("inav.ports.writeConfirm"))) return;
    setBusy(true);
    try {
      const result = await writeSerialPorts(
        ports,
        baseline,
        source === "msp" ? "msp" : "cli",
      );
      if (!result.ok) {
        setError(result.error);
        flash(result.error);
        return;
      }
      flash(
        result.backupPath
          ? t("inav.ports.writeOkBackup", { path: result.backupPath })
          : t("inav.ports.writeOk"),
      );
    } finally {
      setBusy(false);
    }
  };

  const onEeprom = async () => {
    if (!live) return;
    if (!window.confirm(t("inav.eeprom.confirm"))) return;
    setBusy(true);
    try {
      const result = await eepromWriteMsp();
      if (!result.ok) {
        setError(result.error);
        flash(result.error);
        return;
      }
      flash(t("inav.eeprom.saved"));
    } finally {
      setBusy(false);
    }
  };

  const errorText =
    error === "PORTS_NO_DATA"
      ? t("inav.ports.noData")
      : error;

  return (
    <section
      className="space-y-1.5 rounded border border-aether-border bg-aether-surface-raised/40 p-2"
      data-testid="inav-ports-card"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wide text-aether-fg-dim">
          {t("inav.ports.title")}
        </p>
        <button
          type="button"
          data-testid="inav-ports-refresh"
          disabled={!live || busy}
          onClick={() => void onRefresh()}
          className="flex h-7 items-center gap-1 rounded border border-aether-border px-2 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
        >
          <RefreshCw size={12} className={cn(busy && "animate-spin")} />
          {busy ? t("inav.ports.refreshing") : t("inav.ports.refresh")}
        </button>
      </div>
      <p className="text-[10px] leading-relaxed text-aether-fg-dim">
        {t("inav.ports.hint")}
      </p>
      {notice && (
        <p className="text-[10px] text-amber-400" data-testid="inav-ports-notice">
          {t("inav.ports.cliFallback")}
        </p>
      )}
      {errorText && (
        <p className="text-[11px] text-aether-danger">{errorText}</p>
      )}
      {ports.length === 0 ? (
        <p className="text-[11px] text-aether-fg-dim">{t("inav.ports.empty")}</p>
      ) : (
        <ul className="space-y-1">
          {ports.map((p, idx) => (
            <li
              key={`${p.identifier}-${idx}`}
              className="rounded border border-aether-border/80 px-2 py-1"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] text-aether-fg">
                  {serialIdentifierLabel(p.identifier)}
                </span>
                <span className="text-[10px] text-aether-fg-dim">
                  {serialFunctionLabels(p.functionMask).join(" · ")}
                </span>
              </div>
              <label className="mt-1 flex items-center gap-1 text-[10px] text-aether-fg-dim">
                {t("inav.ports.mask")}
                <input
                  type="number"
                  value={p.functionMask}
                  disabled={busy}
                  onChange={(e) => updateMask(idx, Number(e.target.value) || 0)}
                  className="h-6 w-24 rounded border border-aether-border bg-aether-bg px-1 font-mono text-[11px] text-aether-fg"
                />
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={!live || busy || ports.length === 0}
          onClick={() => void onWrite()}
          data-testid="inav-ports-write"
          className="rounded border border-aether-border px-2 py-1 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
        >
          {t("inav.ports.write")}
        </button>
        <button
          type="button"
          disabled={!live || busy}
          onClick={() => void onEeprom()}
          data-testid="inav-eeprom-save"
          className="flex items-center gap-1 rounded border border-aether-border px-2 py-1 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
        >
          <Save size={11} />
          {t("inav.eeprom.save")}
        </button>
      </div>
    </section>
  );
}
