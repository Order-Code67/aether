import { useEffect, useState } from "react";
import { Cpu, FolderOpen, Zap } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import {
  detectDfuUtil,
  flashHex,
  listDfuDevices,
  listenDfuBridge,
  pickHexFile,
  type DfuListResult,
  type DfuUtilInfo,
} from "@/lib/dfuFlash";
import { useInavStore } from "@/stores/inavStore";
import { useLayoutStore } from "@/stores/layoutStore";
import { useSettingsStore } from "@/stores/settingsStore";

/** DFU .hex flash for the in-IDE BPLA wow path (no external app). */
export function IdeFlashCard() {
  const { t, locale } = useI18n();
  const flash = useSettingsStore((s) => s.flashNotice);
  const releasePort = useInavStore((s) => s.releasePort);
  const setBottomPanelVisible = useLayoutStore((s) => s.setBottomPanelVisible);
  const setBottomPanelTab = useLayoutStore((s) => s.setBottomPanelTab);

  const [tool, setTool] = useState<DfuUtilInfo | null>(null);
  const [list, setList] = useState<DfuListResult | null>(null);
  const [hexPath, setHexPath] = useState("");
  const [flashing, setFlashing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void detectDfuUtil().then(setTool);
    let unsub: (() => void) | undefined;
    let cancelled = false;
    void listenDfuBridge((status) => {
      setFlashing(status.running);
      if (!status.running && status.error) {
        setError(status.error);
      }
    }).then((fn) => {
      if (cancelled) fn();
      else unsub = fn;
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const mapError = (code: string | null | undefined): string | null => {
    if (!code) return null;
    if (code === "DFU_UTIL_MISSING") return t("inav.flash.toolMissing");
    if (code === "DFU_HEX_NOT_FOUND") return t("inav.flash.hexMissing");
    if (code === "DFU_HEX_INVALID") return t("inav.flash.hexInvalid");
    if (code === "DFU_FLASH_FAILED") return t("inav.flash.failed");
    if (code === "DFU_USE_DFU_UTIL") return t("inav.flash.needDfuUtil");
    return code;
  };

  const onDetect = async () => {
    setError(null);
    const info = await detectDfuUtil();
    setTool(info);
    const devices = await listDfuDevices();
    setList(devices);
    if (devices.error) setError(mapError(devices.error));
    else if (!info.installed) setError(t("inav.flash.toolMissing"));
    else if (devices.devices.length === 0) setError(t("inav.flash.notInDfu"));
    else flash(t("inav.flash.dfuFound", { count: String(devices.devices.length) }));
  };

  const onPick = async () => {
    const path = await pickHexFile(locale);
    if (path) setHexPath(path);
  };

  const onFlash = async () => {
    if (!hexPath) {
      flash(t("inav.flash.needHex"));
      return;
    }
    if (!window.confirm(t("inav.flash.confirm"))) return;
    setError(null);
    setFlashing(true);
    setBottomPanelVisible(true);
    setBottomPanelTab("output");
    try {
      await releasePort();
      await flashHex(hexPath);
      flash(t("inav.flash.started"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(mapError(msg) ?? msg);
      setFlashing(false);
    }
  };

  return (
    <section
      className="space-y-1.5 rounded border border-aether-border bg-aether-surface-raised/40 p-2"
      data-testid="ide-flash-card"
    >
      <p className="text-[11px] uppercase tracking-wide text-aether-fg-dim">
        {t("inav.flash.title")}
      </p>
      <p className="text-[10px] leading-relaxed text-aether-fg-dim">
        {t("inav.flash.hint")}
      </p>
      {tool && (
        <p className="text-[10px] text-aether-fg-muted">
          {tool.installed
            ? t("inav.flash.toolOk", { path: tool.path ?? "dfu-util" })
            : t("inav.flash.toolMissing")}
        </p>
      )}
      {error && (
        <p className="text-[11px] text-aether-danger" data-testid="ide-flash-error">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          title={t("inav.flash.detectTitle")}
          aria-label={t("inav.flash.detect")}
          onClick={() => void onDetect()}
          disabled={flashing}
          className="flex items-center gap-1 rounded border border-aether-border px-2 py-1 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
        >
          <Cpu size={11} />
          {t("inav.flash.detect")}
        </button>
        <button
          type="button"
          title={t("inav.flash.pickHexTitle")}
          aria-label={t("inav.flash.pickHex")}
          onClick={() => void onPick()}
          disabled={flashing}
          data-testid="ide-flash-pick"
          className="flex items-center gap-1 rounded border border-aether-border px-2 py-1 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
        >
          <FolderOpen size={11} />
          {t("inav.flash.pickHex")}
        </button>
        <button
          type="button"
          title={t("inav.flash.flashTitle")}
          aria-label={t("inav.flash.flash")}
          onClick={() => void onFlash()}
          disabled={flashing || !hexPath}
          data-testid="ide-flash-run"
          className="flex items-center gap-1 rounded border border-aether-accent bg-aether-accent-muted px-2 py-1 text-[11px] text-aether-fg hover:opacity-90 disabled:opacity-40"
        >
          <Zap size={11} />
          {flashing ? t("inav.flash.flashing") : t("inav.flash.flash")}
        </button>
      </div>
      {hexPath && (
        <p className="truncate font-mono text-[10px] text-aether-fg-dim" title={hexPath}>
          {hexPath}
        </p>
      )}
      {list && list.devices.length > 0 && (
        <ul className="space-y-0.5 text-[10px] text-aether-fg-muted">
          {list.devices.slice(0, 6).map((d) => (
            <li key={d} className="truncate font-mono">
              {d}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
