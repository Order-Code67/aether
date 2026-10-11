import { useEffect, useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import { resolveLoraPinMap } from "@/lib/hardwarePinMaps";
import { joinPath } from "@/lib/paths";
import { parsePlatformioIniSnippet } from "@/lib/projectBoardContext";
import { isTauriRuntime } from "@/lib/tauri";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

function regionFromFlags(flags: string[]): string | null {
  const joined = flags.join(" ");
  if (/AETHER_LORA_REGION_US915|CFG_us915/i.test(joined)) return "US915";
  if (/AETHER_LORA_REGION_RU864|CFG_ru864/i.test(joined)) return "RU864";
  if (/AETHER_LORA_REGION_EU868|CFG_eu868|AETHER_LORA_FREQ/i.test(joined)) {
    return "EU868";
  }
  return null;
}

/** Compact read-only board / pin / region strip under the build toolbar. */
export function BoardHardwareStrip() {
  const { t } = useI18n();
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const isProject = usePlatformIoStore((s) => s.isProject);
  const selectedEnv = usePlatformIoStore((s) => s.selectedEnv);
  const [iniSnippet, setIniSnippet] = useState<{
    board: string | null;
    buildFlags: string[];
    libDeps: string[];
  } | null>(null);

  useEffect(() => {
    if (!isTauriRuntime() || !rootPath || !isProject) {
      setIniSnippet(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const text = await readTextFile(joinPath(rootPath, "platformio.ini"));
        if (cancelled) return;
        setIniSnippet(parsePlatformioIniSnippet(text));
      } catch {
        if (!cancelled) setIniSnippet(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rootPath, isProject, selectedEnv]);

  if (!isProject) return null;

  const pinMap = resolveLoraPinMap(selectedEnv || iniSnippet?.board);
  const region = regionFromFlags(iniSnippet?.buildFlags ?? []);
  const hasRadioLibs = (iniSnippet?.libDeps ?? []).some((d) =>
    /radiolib|\blora\b|lmic/i.test(d),
  );

  if (!pinMap && !region && !hasRadioLibs && !selectedEnv) return null;

  const parts: string[] = [];
  if (selectedEnv) parts.push(`env:${selectedEnv}`);
  if (iniSnippet?.board && iniSnippet.board !== selectedEnv) {
    parts.push(`board=${iniSnippet.board}`);
  }
  if (region) parts.push(region);
  if (pinMap) {
    parts.push(
      `NSS=${pinMap.nss} DIO=${pinMap.dio} RST=${pinMap.rst}${
        pinMap.busy >= 0 ? ` BUSY=${pinMap.busy}` : ""
      }`,
    );
    if (pinMap.oledSda != null && pinMap.oledScl != null) {
      parts.push(`OLED ${pinMap.oledSda}/${pinMap.oledScl}`);
    }
  } else if (hasRadioLibs) {
    parts.push(t("boardStrip.radioLibs"));
  }

  return (
    <div
      className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-aether-border bg-aether-surface/60 px-2 py-1 text-[10px] text-aether-fg-muted"
      data-testid="board-hardware-strip"
      title={t("boardStrip.hint")}
    >
      <span className="font-medium uppercase tracking-wide text-aether-fg-dim">
        {t("boardStrip.label")}
      </span>
      <span className="font-mono text-aether-fg">{parts.join(" · ")}</span>
    </div>
  );
}
