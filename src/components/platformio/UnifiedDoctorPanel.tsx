import { useEffect, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Stethoscope,
  XCircle,
} from "lucide-react";
import { PanelHint } from "@/components/hints/PanelHint";
import { useI18n } from "@/hooks/useI18n";
import {
  configuratorErrorMessage,
  detectAetherConfigurator,
  openAetherConfigurator,
  type AetherConfiguratorInfo,
} from "@/lib/aetherConfigurator";
import { openArduinoCliInstallDocs } from "@/lib/arduinoCli";
import { cn } from "@/lib/cn";
import { openWindowsOptionalFeatures } from "@/lib/platformio";
import { isTauriRuntime } from "@/lib/tauri";
import { useInavStore } from "@/stores/inavStore";
import { useLayoutStore } from "@/stores/layoutStore";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useSerialStore } from "@/stores/serialStore";
import { useSettingsStore } from "@/stores/settingsStore";

const PIO_DOCS =
  "https://docs.platformio.org/en/latest/core/installation.html";
const PYTHON_DOCS = "https://www.python.org/downloads/";
const CH340_DRIVERS = "https://www.wch-ic.com/downloads/CH341SER_EXE.html";
const CP210X_DRIVERS =
  "https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers";
const CONFIGURATOR_DOCS =
  "https://github.com/Order-Code67/aether/blob/main/docs/AETHER_CONFIGURATOR.md";

const isWindows =
  typeof navigator !== "undefined" &&
  /windows/i.test(navigator.userAgent || navigator.platform || "");

async function openExternal(url: string) {
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

type RowStatus = "ok" | "warn" | "missing" | "checking";

function StatusIcon({ status }: { status: RowStatus }) {
  if (status === "checking") {
    return <Loader2 size={14} className="animate-spin text-aether-fg-muted" />;
  }
  if (status === "ok") {
    return <CheckCircle2 size={14} className="text-aether-accent" />;
  }
  if (status === "warn") {
    return <XCircle size={14} className="text-aether-warning" />;
  }
  return <XCircle size={14} className="text-aether-danger" />;
}

function DoctorRow({
  title,
  detail,
  status,
  actions,
}: {
  title: string;
  detail: string;
  status: RowStatus;
  actions: ReactNode;
}) {
  return (
    <li
      className="rounded border border-aether-border/70 bg-aether-bg/30 px-2.5 py-2"
      data-testid="doctor-row"
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0">
          <StatusIcon status={status} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-aether-fg">{title}</p>
          <p className="mt-0.5 text-[10px] leading-relaxed text-aether-fg-muted">
            {detail}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">{actions}</div>
        </div>
      </div>
    </li>
  );
}

function ActionBtn({
  label,
  title,
  onClick,
  disabled,
  primary,
  testId,
}: {
  label: string;
  title?: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      title={title ?? label}
      aria-label={label}
      disabled={disabled}
      data-testid={testId}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] disabled:opacity-40",
        primary
          ? "border-aether-accent bg-aether-accent text-white hover:opacity-90"
          : "border-aether-border bg-aether-bg text-aether-fg hover:bg-aether-surface-raised",
      )}
    >
      {label}
    </button>
  );
}

/** Full toolchain / COM / cache / Configurator status surface. */
export function UnifiedDoctorPanel() {
  const { t, locale } = useI18n();
  const tauri = isTauriRuntime();
  const doctor = usePlatformIoStore((s) => s.doctor);
  const offlineCache = usePlatformIoStore((s) => s.offlineCache);
  const offlineCacheChecking = usePlatformIoStore((s) => s.offlineCacheChecking);
  const sidecarOfflineZips = usePlatformIoStore((s) => s.sidecarOfflineZips);
  const running = usePlatformIoStore((s) => s.running);
  const runDoctor = usePlatformIoStore((s) => s.runDoctor);
  const installMissing = usePlatformIoStore((s) => s.installMissing);
  const refreshOfflineCache = usePlatformIoStore((s) => s.refreshOfflineCache);
  const prepareOfflineCache = usePlatformIoStore((s) => s.prepareOfflineCache);
  const importSidecarOfflineZip = usePlatformIoStore(
    (s) => s.importSidecarOfflineZip,
  );
  const ports = useSerialStore((s) => s.ports);
  const refreshPorts = useSerialStore((s) => s.refreshPorts);
  const selectedPath = useSerialStore((s) => s.selectedPath);
  const openSettings = useSettingsStore((s) => s.openSettings);
  const flashNotice = useSettingsStore((s) => s.flashNotice);
  const setActiveActivity = useLayoutStore((s) => s.setActiveActivity);
  const setBottomPanelTab = useLayoutStore((s) => s.setBottomPanelTab);

  const [cfg, setCfg] = useState<AetherConfiguratorInfo | "checking">("checking");
  const [cfgBusy, setCfgBusy] = useState(false);

  const refreshConfigurator = async () => {
    if (!tauri) {
      setCfg({ installed: false, path: null });
      return;
    }
    setCfg("checking");
    try {
      setCfg(await detectAetherConfigurator());
    } catch {
      setCfg({ installed: false, path: null });
    }
  };

  useEffect(() => {
    if (!tauri) return;
    void runDoctor();
    void refreshOfflineCache();
    void refreshPorts();
    void refreshConfigurator();
  }, [tauri, runDoctor, refreshOfflineCache, refreshPorts]);

  const busy = doctor.checking || doctor.installing || running;
  const pio = doctor.pio;
  const python = doctor.python;
  const arduinoCli = doctor.arduinoCli;
  const radio = doctor.radio;
  const radioTips =
    locale === "ru" ? (radio?.tipsRu ?? []) : (radio?.tipsEn ?? []);

  const platformsOk =
    offlineCache != null &&
    offlineCache.espressif32 &&
    offlineCache.atmelavr;
  const sidecar = sidecarOfflineZips[0] ?? null;

  const recheckAll = () => {
    void runDoctor();
    void refreshOfflineCache();
    void refreshPorts();
    void refreshConfigurator();
  };

  return (
    <div className="flex h-full flex-col" data-testid="unified-doctor-panel">
      <header className="flex h-9 shrink-0 items-center justify-between gap-2 px-3">
        <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-aether-fg-muted">
          <Stethoscope size={12} />
          {t("doctor.panelTitle")}
        </h2>
        <button
          type="button"
          title={t("doctor.recheckAllTitle")}
          aria-label={t("doctor.recheck")}
          disabled={busy || !tauri}
          onClick={recheckAll}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg disabled:opacity-40"
        >
          <RefreshCw size={12} className={doctor.checking ? "animate-spin" : ""} />
          {t("doctor.recheck")}
        </button>
      </header>

      <div className="aether-scroll min-h-0 flex-1 space-y-2 overflow-auto px-3 pb-4">
        <PanelHint messageKey="hints.panel.doctor" />

        {!tauri && (
          <p className="text-[11px] text-aether-fg-dim">{t("doctor.needDesktop")}</p>
        )}

        {doctor.installError && (
          <p className="text-[11px] text-aether-danger">{doctor.installError}</p>
        )}

        <ul className="space-y-2">
          <DoctorRow
            title={t("doctor.row.pio")}
            status={
              doctor.checking
                ? "checking"
                : pio?.installed
                  ? "ok"
                  : "missing"
            }
            detail={
              doctor.checking
                ? t("doctor.checking")
                : pio?.installed
                  ? t("doctor.pioOk", { version: pio.version ?? "OK" })
                  : t("doctor.pioMissing")
            }
            actions={
              <>
                {!pio?.installed && (
                  <ActionBtn
                    label={t("doctor.installMissing")}
                    primary
                    disabled={busy || !python?.installed}
                    onClick={() => void installMissing()}
                    testId="doctor-fix-pio"
                  />
                )}
                <ActionBtn
                  label={t("doctor.recheck")}
                  disabled={busy}
                  onClick={() => void runDoctor()}
                />
                {!pio?.installed && (
                  <ActionBtn
                    label={t("doctor.openDocs")}
                    onClick={() => void openExternal(PIO_DOCS)}
                  />
                )}
              </>
            }
          />

          <DoctorRow
            title={t("doctor.row.arduinoCli")}
            status={
              doctor.checking
                ? "checking"
                : arduinoCli?.installed
                  ? "ok"
                  : "warn"
            }
            detail={
              doctor.checking
                ? t("doctor.checking")
                : arduinoCli?.installed
                  ? t("doctor.arduinoCliOk", {
                      version:
                        arduinoCli.version || arduinoCli.path || "OK",
                    })
                  : t("doctor.arduinoCliMissing")
            }
            actions={
              <>
                {!arduinoCli?.installed && (
                  <ActionBtn
                    label={t("doctor.openArduinoCli")}
                    primary
                    onClick={() => void openArduinoCliInstallDocs()}
                    testId="doctor-fix-arduino-cli"
                  />
                )}
                <ActionBtn
                  label={t("doctor.recheck")}
                  disabled={busy}
                  onClick={() => void runDoctor()}
                />
                <ActionBtn
                  label={t("settings.tools")}
                  onClick={() => openSettings("tools")}
                />
              </>
            }
          />

          <DoctorRow
            title={t("doctor.row.com")}
            status={
              !tauri
                ? "warn"
                : ports.length > 0
                  ? "ok"
                  : "warn"
            }
            detail={
              !tauri
                ? t("doctor.needDesktop")
                : ports.length > 0
                  ? t("doctor.comOk", {
                      count: ports.length,
                      port: selectedPath || ports[0]?.path || "—",
                    })
                  : t("doctor.comMissing")
            }
            actions={
              <>
                <ActionBtn
                  label={t("doctor.recheck")}
                  disabled={!tauri}
                  onClick={() => void refreshPorts()}
                  testId="doctor-recheck-com"
                />
                <ActionBtn
                  label={t("panel.serial")}
                  onClick={() => setBottomPanelTab("serial")}
                />
              </>
            }
          />

          <DoctorRow
            title={t("doctor.row.drivers")}
            status="warn"
            detail={t("doctor.driversHint")}
            actions={
              <>
                {isWindows && (
                  <ActionBtn
                    label={t("doctor.openOptionalFeatures")}
                    onClick={() => {
                      void openWindowsOptionalFeatures().catch(() => {
                        void openExternal("ms-settings:optionalfeatures");
                      });
                    }}
                  />
                )}
                <ActionBtn
                  label={t("doctor.openCh340")}
                  onClick={() => void openExternal(CH340_DRIVERS)}
                  testId="doctor-fix-ch340"
                />
                <ActionBtn
                  label={t("doctor.openCp210x")}
                  onClick={() => void openExternal(CP210X_DRIVERS)}
                />
              </>
            }
          />

          <DoctorRow
            title={t("doctor.row.offline")}
            status={
              offlineCacheChecking
                ? "checking"
                : platformsOk
                  ? "ok"
                  : offlineCache
                    ? "warn"
                    : "warn"
            }
            detail={
              offlineCacheChecking
                ? t("offline.checking")
                : platformsOk
                  ? t("doctor.offlineOk")
                  : t("doctor.offlineMissing")
            }
            actions={
              <>
                <ActionBtn
                  label={t("doctor.recheck")}
                  disabled={!tauri || offlineCacheChecking}
                  onClick={() => void refreshOfflineCache()}
                />
                {!platformsOk && (
                  <ActionBtn
                    label={t("offline.prepare")}
                    primary
                    disabled={!tauri || busy}
                    onClick={() => void prepareOfflineCache()}
                    testId="doctor-fix-offline"
                  />
                )}
                {sidecar && (
                  <ActionBtn
                    label={t("offline.importSidecar")}
                    disabled={!tauri || busy}
                    onClick={() => void importSidecarOfflineZip()}
                  />
                )}
                <ActionBtn
                  label={t("offline.title")}
                  onClick={() => openSettings("tools")}
                />
              </>
            }
          />

          <DoctorRow
            title={t("doctor.row.configurator")}
            status={
              cfg === "checking"
                ? "checking"
                : cfg.installed
                  ? "ok"
                  : "warn"
            }
            detail={
              cfg === "checking"
                ? t("doctor.checking")
                : cfg.installed
                  ? t("doctor.configuratorOk", {
                      path: cfg.path ?? "OK",
                    })
                  : t("doctor.configuratorMissing")
            }
            actions={
              <>
                {cfg !== "checking" && cfg.installed && (
                  <ActionBtn
                    label={t("doctor.configuratorOpen")}
                    primary
                    disabled={cfgBusy || !tauri}
                    onClick={() => {
                      setCfgBusy(true);
                      void (async () => {
                        try {
                          await useInavStore.getState().releasePort();
                          const baud = useSerialStore.getState().baudRate;
                          await openAetherConfigurator({
                            port: selectedPath || undefined,
                            baud,
                          });
                          flashNotice(t("bplaPath.configuratorReleased"), 5000);
                        } catch (e) {
                          const raw = configuratorErrorMessage(e);
                          flashNotice(
                            raw.includes("AETHER_CONFIGURATOR_MISSING")
                              ? t("bplaPath.configuratorMissing")
                              : raw || t("inav.configuratorFailed"),
                          );
                        } finally {
                          setCfgBusy(false);
                        }
                      })();
                    }}
                    testId="doctor-open-configurator"
                  />
                )}
                <ActionBtn
                  label={t("doctor.recheck")}
                  disabled={!tauri}
                  onClick={() => void refreshConfigurator()}
                />
                {(cfg === "checking" || !cfg.installed) && (
                  <ActionBtn
                    label={t("doctor.configuratorDocs")}
                    onClick={() => void openExternal(CONFIGURATOR_DOCS)}
                  />
                )}
                <ActionBtn
                  label={t("activity.inav")}
                  onClick={() => setActiveActivity("inav")}
                />
              </>
            }
          />

          {!python?.installed && (
            <DoctorRow
              title={t("doctor.row.python")}
              status="missing"
              detail={t("doctor.pythonMissing")}
              actions={
                <ActionBtn
                  label={t("doctor.openPython")}
                  primary
                  onClick={() => void openExternal(PYTHON_DOCS)}
                />
              }
            />
          )}
        </ul>

        {radio?.isRadioProject && radioTips.length > 0 && (
          <div className="rounded border border-aether-border/70 px-2.5 py-2">
            <p className="text-[11px] font-medium text-aether-fg">
              {t("doctor.radioTitle")}
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[10px] text-aether-fg-muted">
              {radioTips.slice(0, 6).map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        )}

        {doctor.installing && (
          <p className="flex items-center gap-1.5 text-[11px] text-aether-fg-muted">
            <Loader2 size={12} className="animate-spin" />
            {t("doctor.installing")}
            <Download size={12} />
          </p>
        )}

        <p className="flex items-center gap-1 text-[10px] text-aether-fg-dim">
          <ExternalLink size={10} />
          {t("doctor.panelFooter")}
        </p>
      </div>
    </div>
  );
}
