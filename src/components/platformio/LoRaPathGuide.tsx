import { useEffect, useState } from "react";
import {
  Activity,
  Radio,
  Stethoscope,
  Upload,
  MapPin,
} from "lucide-react";
import { OpenExamplesDialog } from "@/components/explorer/OpenExamplesDialog";
import { NewProjectDialog } from "@/components/explorer/NewProjectDialog";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import { resolveLoraPinMap } from "@/lib/hardwarePinMaps";
import { joinPath } from "@/lib/paths";
import { parsePlatformioIniSnippet } from "@/lib/projectBoardContext";
import { isTauriRuntime } from "@/lib/tauri";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { openLoraTxRxPair } from "@/lib/loraPair";
import { useLayoutStore } from "@/stores/layoutStore";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

/**
 * One-screen LoRa wow path: wizard → pins → TX/RX/Join → Plotter → Doctor.
 * Visible when the open project looks like radio / LoRa.
 */
export function LoRaPathGuide() {
  const { t } = useI18n();
  const isProject = usePlatformIoStore((s) => s.isProject);
  const radio = usePlatformIoStore((s) => s.doctor.radio);
  const selectedEnv = usePlatformIoStore((s) => s.selectedEnv);
  const showDoctor = usePlatformIoStore((s) => s.showDoctor);
  const runDoctor = usePlatformIoStore((s) => s.runDoctor);
  const runTask = usePlatformIoStore((s) => s.runTask);
  const running = usePlatformIoStore((s) => s.running);
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const flashNotice = useSettingsStore((s) => s.flashNotice);
  const setBottomPanelVisible = useLayoutStore((s) => s.setBottomPanelVisible);
  const setBottomPanelTab = useLayoutStore((s) => s.setBottomPanelTab);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [iniRadio, setIniRadio] = useState(false);
  const [pairBusy, setPairBusy] = useState(false);

  useEffect(() => {
    if (!isTauriRuntime() || !rootPath || !isProject) {
      setIniRadio(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const text = await readTextFile(joinPath(rootPath, "platformio.ini"));
        if (cancelled) return;
        const snip = parsePlatformioIniSnippet(text);
        const pin = resolveLoraPinMap(selectedEnv || snip.board);
        const libs = snip.libDeps.some((d) => /radiolib|\blora\b|lmic/i.test(d));
        setIniRadio(Boolean(pin || libs));
        if (pin || libs) void runDoctor();
      } catch {
        if (!cancelled) setIniRadio(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rootPath, isProject, selectedEnv, runDoctor]);

  const isRadio = Boolean(radio?.isRadioProject || iniRadio);
  if (dismissed || !isProject || !isRadio) return null;

  const steps = [
    {
      id: "pins",
      icon: MapPin,
      label: t("loraPath.step.pins"),
      titleKey: "loraPath.step.pinsTitle" as const,
      action: () => {
        /* BoardHardwareStrip is always above — nudge Doctor for pin map tip */
        showDoctor();
      },
    },
    {
      id: "upload",
      icon: Upload,
      label: t("loraPath.step.upload"),
      titleKey: "loraPath.step.uploadTitle" as const,
      action: () => {
        if (!rootPath || running) return;
        void runTask("upload");
        setBottomPanelVisible(true);
        setBottomPanelTab("output");
      },
    },
    {
      id: "plotter",
      icon: Activity,
      label: t("loraPath.step.plotter"),
      titleKey: "loraPath.step.plotterTitle" as const,
      action: () => {
        setBottomPanelVisible(true);
        setBottomPanelTab("plotter");
      },
    },
    {
      id: "doctor",
      icon: Stethoscope,
      label: t("loraPath.step.doctor"),
      titleKey: "loraPath.step.doctorTitle" as const,
      action: () => showDoctor(),
    },
  ] as const;

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 border-b border-aether-border bg-cyan-950/20 px-2 py-1 text-[10px]"
      data-testid="lora-path-guide"
    >
      <NewProjectDialog open={wizardOpen} onClose={() => setWizardOpen(false)} />
      <OpenExamplesDialog
        open={examplesOpen}
        onClose={() => setExamplesOpen(false)}
      />
      <span className="mr-1 flex items-center gap-1 font-medium uppercase tracking-wide text-cyan-300/90">
        <Radio size={11} />
        {t("loraPath.title")}
      </span>
      <button
        type="button"
        title={t("loraPath.wizardTitle")}
        aria-label={t("loraPath.wizard")}
        onClick={() => setWizardOpen(true)}
        className="rounded border border-aether-border/80 px-1.5 py-0.5 text-aether-fg-muted hover:text-aether-fg"
      >
        {t("loraPath.wizard")}
      </button>
      <button
        type="button"
        title={t("loraPath.examplesTitle")}
        aria-label={t("loraPath.examples")}
        onClick={() => setExamplesOpen(true)}
        className="rounded border border-aether-border/80 px-1.5 py-0.5 text-aether-fg-muted hover:text-aether-fg"
      >
        {t("loraPath.examples")}
      </button>
      <button
        type="button"
        data-testid="lora-path-pair"
        title={t("loraPath.pairTitle")}
        aria-label={t("loraPath.pair")}
        disabled={pairBusy || !isTauriRuntime()}
        onClick={() => {
          setPairBusy(true);
          void openLoraTxRxPair(selectedEnv || "heltec_wifi_lora_32_V3")
            .then(() => {
              flashNotice(t("loraPath.pairOpened"), 4000);
            })
            .catch((e) => {
              flashNotice(
                e instanceof Error ? e.message : t("loraPath.pairFailed"),
              );
            })
            .finally(() => setPairBusy(false));
        }}
        className="rounded border border-cyan-500/40 px-1.5 py-0.5 text-cyan-200/90 hover:border-cyan-400 disabled:opacity-40"
      >
        {pairBusy ? "…" : t("loraPath.pair")}
      </button>
      {steps.map((step) => {
        const Icon = step.icon;
        return (
          <button
            key={step.id}
            type="button"
            data-testid={`lora-path-${step.id}`}
            title={t(step.titleKey)}
            aria-label={step.label}
            onClick={step.action}
            className={cn(
              "inline-flex items-center gap-1 rounded border border-aether-border/80 px-1.5 py-0.5",
              "text-aether-fg-muted hover:border-cyan-500/50 hover:text-aether-fg",
            )}
          >
            <Icon size={10} />
            {step.label}
          </button>
        );
      })}
      <button
        type="button"
        aria-label={t("doctor.dismiss")}
        title={t("doctor.dismiss")}
        onClick={() => setDismissed(true)}
        className="ml-auto px-1 text-aether-fg-dim hover:text-aether-fg"
      >
        ×
      </button>
    </div>
  );
}
