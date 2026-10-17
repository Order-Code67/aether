import { useEffect, useState } from "react";
import {
  Activity,
  Radio,
  Stethoscope,
  Upload,
  MapPin,
  Layers,
  Terminal,
} from "lucide-react";
import { OpenExamplesDialog } from "@/components/explorer/OpenExamplesDialog";
import { NewProjectDialog } from "@/components/explorer/NewProjectDialog";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import { resolveLoraPinMap } from "@/lib/hardwarePinMaps";
import {
  flashLoraPairBoth,
  getLastLoraPair,
  openLoraTxRxPair,
  openLorawanJoinExample,
} from "@/lib/loraPair";
import { LORA_REGIONS, type LoraRegionId } from "@/lib/loraRegions";
import { joinPath } from "@/lib/paths";
import { parsePlatformioIniSnippet } from "@/lib/projectBoardContext";
import { isTauriRuntime } from "@/lib/tauri";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useLayoutStore } from "@/stores/layoutStore";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

/**
 * One-screen LoRa wow path: wizard → pins → TX/RX/Join → Plotter → Doctor.
 * Visible when the open project looks like radio / LoRa.
 */
export function LoRaPathGuide() {
  const { t, locale } = useI18n();
  const isProject = usePlatformIoStore((s) => s.isProject);
  const radio = usePlatformIoStore((s) => s.doctor.radio);
  const selectedEnv = usePlatformIoStore((s) => s.selectedEnv);
  const openDoctorPanel = usePlatformIoStore((s) => s.openDoctorPanel);
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
  const [flashBusy, setFlashBusy] = useState(false);
  const [joinBusy, setJoinBusy] = useState(false);
  const [region, setRegion] = useState<LoraRegionId>("EU868");

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
        const snip = parsePlatformioIniSnippet(text, selectedEnv || null);
        const pin = resolveLoraPinMap(selectedEnv || snip.board);
        const libs = snip.libDeps.some((d) => /radiolib|\blora\b|lmic/i.test(d));
        setIniRadio(Boolean(pin || libs));
        const m = text.match(/-DAETHER_LORA_REGION_(EU868|US915|RU864)/);
        if (m?.[1]) setRegion(m[1] as LoraRegionId);
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

  const env = selectedEnv || "heltec_wifi_lora_32_V3";

  const steps = [
    {
      id: "pins",
      icon: MapPin,
      label: t("loraPath.step.pins"),
      titleKey: "loraPath.step.pinsTitle" as const,
      action: () => {
        openDoctorPanel();
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
      id: "flashBoth",
      icon: Layers,
      label: t("loraPath.step.flashBoth"),
      titleKey: "loraPath.step.flashBothTitle" as const,
      action: () => {
        if (running || flashBusy) return;
        setFlashBusy(true);
        setBottomPanelVisible(true);
        setBottomPanelTab("output");
        void flashLoraPairBoth(getLastLoraPair())
          .then(() => {
            flashNotice(t("loraPath.flashBothDone"), 5000);
            setBottomPanelTab("serial");
          })
          .catch((e) => {
            flashNotice(
              e instanceof Error ? e.message : t("loraPath.flashBothFailed"),
            );
            openDoctorPanel();
          })
          .finally(() => setFlashBusy(false));
      },
    },
    {
      id: "serial",
      icon: Terminal,
      label: t("loraPath.step.serialRx"),
      titleKey: "loraPath.step.serialRxTitle" as const,
      action: () => {
        setBottomPanelVisible(true);
        setBottomPanelTab("serial");
        flashNotice(t("loraPath.serialRxHint"), 4000);
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
      action: () => openDoctorPanel(),
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
      <label
        className="inline-flex items-center gap-1 text-aether-fg-muted"
        title={t("loraPath.regionTitle")}
      >
        <span className="sr-only">{t("wizard.region")}</span>
        <select
          data-testid="lora-path-region"
          value={region}
          disabled={pairBusy || joinBusy}
          onChange={(e) => setRegion(e.target.value as LoraRegionId)}
          className="h-5 max-w-[110px] rounded border border-aether-border/80 bg-transparent px-1 text-[10px] text-aether-fg"
          aria-label={t("wizard.region")}
        >
          {LORA_REGIONS.map((r) => (
            <option key={r.id} value={r.id}>
              {locale === "ru" ? r.labelRu : r.labelEn}
            </option>
          ))}
        </select>
      </label>
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
          void openLoraTxRxPair({ env, region })
            .then(() => {
              flashNotice(t("loraPath.pairOpened"), 4000);
              void runDoctor();
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
      <button
        type="button"
        data-testid="lora-path-join"
        title={t("loraPath.joinTitle")}
        aria-label={t("loraPath.join")}
        disabled={joinBusy || !isTauriRuntime()}
        onClick={() => {
          setJoinBusy(true);
          void openLorawanJoinExample(env, region)
            .then(() => {
              flashNotice(t("loraPath.joinOpened"), 5000);
              void runDoctor();
            })
            .catch((e) => {
              flashNotice(
                e instanceof Error ? e.message : t("loraPath.joinFailed"),
              );
            })
            .finally(() => setJoinBusy(false));
        }}
        className="rounded border border-aether-border/80 px-1.5 py-0.5 text-aether-fg-muted hover:border-cyan-500/50 hover:text-aether-fg disabled:opacity-40"
      >
        {joinBusy ? "…" : t("loraPath.join")}
      </button>
      {steps.map((step) => {
        const Icon = step.icon;
        const busy =
          (step.id === "flashBoth" && flashBusy) ||
          (step.id === "upload" && running);
        return (
          <button
            key={step.id}
            type="button"
            data-testid={`lora-path-${step.id}`}
            title={t(step.titleKey)}
            aria-label={step.label}
            disabled={busy}
            onClick={step.action}
            className={cn(
              "inline-flex items-center gap-1 rounded border border-aether-border/80 px-1.5 py-0.5",
              "text-aether-fg-muted hover:border-cyan-500/50 hover:text-aether-fg",
              "disabled:opacity-40",
            )}
          >
            <Icon size={10} />
            {busy ? "…" : step.label}
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
