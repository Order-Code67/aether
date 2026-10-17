import { useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  X,
} from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { openArduinoCliInstallDocs } from "@/lib/arduinoCli";
import { openWindowsOptionalFeatures } from "@/lib/platformio";
import { isTauriRuntime } from "@/lib/tauri";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useSettingsStore } from "@/stores/settingsStore";

const PIO_DOCS =
  "https://docs.platformio.org/en/latest/core/installation.html";
const CLANGD_DOCS = "https://clangd.llvm.org/installation.html";
const PYTHON_DOCS = "https://www.python.org/downloads/";
const CH340_DRIVERS = "https://www.wch-ic.com/downloads/CH341SER_EXE.html";
const CP210X_DRIVERS =
  "https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers";

async function openExternal(url: string) {
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

const isWindows =
  typeof navigator !== "undefined" &&
  /windows/i.test(navigator.userAgent || navigator.platform || "");

/** Non-blocking startup check for PlatformIO / Python / drivers (desktop only). */
export function ToolsDoctorBanner() {
  const { t } = useI18n();
  const doctor = usePlatformIoStore((s) => s.doctor);
  const dismissed = usePlatformIoStore((s) => s.doctorDismissed);
  const runDoctor = usePlatformIoStore((s) => s.runDoctor);
  const installMissing = usePlatformIoStore((s) => s.installMissing);
  const dismissDoctor = usePlatformIoStore((s) => s.dismissDoctor);
  const sidecarOfflineZips = usePlatformIoStore((s) => s.sidecarOfflineZips);
  const offlineCache = usePlatformIoStore((s) => s.offlineCache);
  const importSidecarOfflineZip = usePlatformIoStore(
    (s) => s.importSidecarOfflineZip,
  );
  const running = usePlatformIoStore((s) => s.running);
  const openSettings = useSettingsStore((s) => s.openSettings);
  const openDoctorPanel = usePlatformIoStore((s) => s.openDoctorPanel);
  const locale = useSettingsStore((s) => s.locale);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    void runDoctor();
  }, [runDoctor]);

  if (!isTauriRuntime() || !doctor.checked || dismissed) {
    return null;
  }

  const radio = doctor.radio;
  const showRadio =
    Boolean(radio?.isRadioProject) && (radio?.tipsEn.length ?? 0) > 0;
  const platformsMissing =
    offlineCache != null &&
    (!offlineCache.espressif32 || !offlineCache.atmelavr);
  const sidecar = sidecarOfflineZips[0] ?? null;
  const showSidecar = Boolean(sidecar) && (platformsMissing || !doctor.ok);

  // Hide when PlatformIO is healthy and there are no radio / sidecar tips.
  if (doctor.ok && !doctor.installing && !showRadio && !showSidecar) {
    return null;
  }

  const pio = doctor.pio;
  const python = doctor.python;
  const clangd = doctor.clangd;
  const arduinoCli = doctor.arduinoCli;
  const pioMissing = !pio?.installed;
  const pythonMissing = !python?.installed;
  const arduinoCliMissing = !arduinoCli?.installed;
  const severity = pioMissing ? "warning" : "info";
  const busy = doctor.checking || doctor.installing;
  const radioTips =
    locale === "ru" ? (radio?.tipsRu ?? []) : (radio?.tipsEn ?? []);

  return (
    <div
      data-aether-chrome
      role="status"
      className={
        severity === "warning"
          ? "flex shrink-0 items-start gap-3 border-b border-aether-warning/40 bg-aether-warning/10 px-3 py-2 text-[11px] text-aether-fg"
          : "flex shrink-0 items-start gap-3 border-b border-aether-border bg-aether-surface px-3 py-2 text-[11px] text-aether-fg"
      }
    >
      {pioMissing ? (
        <AlertTriangle
          size={14}
          className="mt-0.5 shrink-0 text-aether-warning"
        />
      ) : (
        <CheckCircle2
          size={14}
          className="mt-0.5 shrink-0 text-aether-accent"
        />
      )}

      <div className="min-w-0 flex-1 space-y-1">
        {(!doctor.ok || doctor.installing || doctor.checking) && (
          <>
            <p className="font-medium">{t("doctor.title")}</p>
            {doctor.checking ? (
              <p className="text-aether-fg-muted">{t("doctor.checking")}</p>
            ) : (
              <ul className="space-y-0.5 text-aether-fg-muted">
                <li>
                  {pioMissing
                    ? t("doctor.pioMissing")
                    : t("doctor.pioOk", {
                        version: pio?.version ?? "OK",
                      })}
                </li>
                <li>
                  {pythonMissing
                    ? t("doctor.pythonMissing")
                    : t("doctor.pythonOk", {
                        version: python?.version ?? "OK",
                      })}
                </li>
                <li>
                  {arduinoCliMissing
                    ? t("doctor.arduinoCliMissing")
                    : t("doctor.arduinoCliOk", {
                        version:
                          arduinoCli?.version || arduinoCli?.path || "OK",
                      })}
                </li>
                <li>{t("doctor.driversHint")}</li>
                <li>
                  {!clangd?.installed
                    ? t("doctor.clangdMissing")
                    : t("doctor.clangdOk", {
                        version: clangd.version ?? "OK",
                      })}
                </li>
              </ul>
            )}
          </>
        )}

        {showRadio && (
          <div className="space-y-0.5">
            <p className="font-medium">{t("doctor.radioTitle")}</p>
            <ul className="list-disc space-y-0.5 pl-4 text-aether-fg-muted">
              {radioTips.slice(0, 4).map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        )}

        {doctor.installing && (
          <p className="flex items-center gap-1.5 text-aether-fg-muted">
            <Loader2 size={12} className="animate-spin" />
            {t("doctor.installing")}
          </p>
        )}

        {doctor.installError && (
          <p className="text-aether-danger">{doctor.installError}</p>
        )}

        {(!doctor.ok || doctor.installing) && (
          <>
            <p className="text-aether-fg-dim">{t("doctor.platformsNote")}</p>
            <p className="text-aether-fg-dim">{t("doctor.offlineHint")}</p>
          </>
        )}

        {showSidecar && sidecar && (
          <p className="text-aether-fg-muted" data-testid="doctor-sidecar-hint">
            {t("offline.sidecarFound", {
              file: sidecar.path.split(/[/\\]/).pop() ?? sidecar.path,
            })}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {showSidecar && (
            <button
              type="button"
              disabled={busy || running}
              data-testid="doctor-import-sidecar"
              onClick={() => {
                void importSidecarOfflineZip();
              }}
              className="inline-flex items-center gap-1 rounded border border-aether-accent bg-aether-accent px-2 py-0.5 text-[11px] text-white hover:opacity-90 disabled:opacity-40"
            >
              <Download size={11} />
              {t("offline.importSidecar")}
            </button>
          )}
          {pioMissing && (
            <button
              type="button"
              disabled={busy || pythonMissing}
              title={
                pythonMissing
                  ? t("doctor.pythonMissing")
                  : t("doctor.installMissing")
              }
              onClick={() => {
                void installMissing();
              }}
              className="inline-flex items-center gap-1 rounded border border-aether-accent bg-aether-accent px-2 py-0.5 text-[11px] text-white hover:opacity-90 disabled:opacity-40"
            >
              {doctor.installing ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <Download size={11} />
              )}
              {t("doctor.installMissing")}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void runDoctor();
            }}
            className="rounded border border-aether-border bg-aether-bg px-2 py-0.5 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
          >
            {t("doctor.recheck")}
          </button>
          <button
            type="button"
            onClick={() => openDoctorPanel()}
            className="rounded border border-aether-border bg-aether-bg px-2 py-0.5 text-[11px] text-aether-fg hover:bg-aether-surface-raised"
            data-testid="doctor-banner-open-panel"
          >
            {t("doctor.openPanel")}
          </button>
          <button
            type="button"
            onClick={() => openSettings("tools")}
            className="rounded border border-aether-border bg-aether-bg px-2 py-0.5 text-[11px] text-aether-fg hover:bg-aether-surface-raised"
          >
            {t("offline.title")}
          </button>
          {pioMissing && (
            <button
              type="button"
              onClick={() => {
                void openExternal(PIO_DOCS);
              }}
              className="inline-flex items-center gap-1 text-[11px] text-aether-accent hover:underline"
            >
              <ExternalLink size={11} />
              {t("doctor.openDocs")}
            </button>
          )}
          {arduinoCliMissing && (
            <button
              type="button"
              onClick={() => {
                void openArduinoCliInstallDocs();
              }}
              className="inline-flex items-center gap-1 text-[11px] text-aether-accent hover:underline"
              title={t("doctor.openArduinoCliTitle")}
            >
              <ExternalLink size={11} />
              {t("doctor.openArduinoCli")}
            </button>
          )}
          {pythonMissing && (
            <button
              type="button"
              onClick={() => {
                void openExternal(PYTHON_DOCS);
              }}
              className="inline-flex items-center gap-1 text-[11px] text-aether-accent hover:underline"
            >
              <ExternalLink size={11} />
              {t("doctor.openPython")}
            </button>
          )}
          {isWindows && (
            <button
              type="button"
              onClick={() => {
                void openWindowsOptionalFeatures().catch(() => {
                  void openExternal("ms-settings:optionalfeatures");
                });
              }}
              className="inline-flex items-center gap-1 text-[11px] text-aether-accent hover:underline"
            >
              <ExternalLink size={11} />
              {t("doctor.openOptionalFeatures")}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              void openExternal(CH340_DRIVERS);
            }}
            className="inline-flex items-center gap-1 text-[11px] text-aether-accent hover:underline"
          >
            <ExternalLink size={11} />
            {t("doctor.openCh340")}
          </button>
          <button
            type="button"
            onClick={() => {
              void openExternal(CP210X_DRIVERS);
            }}
            className="inline-flex items-center gap-1 text-[11px] text-aether-accent hover:underline"
          >
            <ExternalLink size={11} />
            {t("doctor.openCp210x")}
          </button>
          {!clangd?.installed && (
            <button
              type="button"
              onClick={() => {
                void openExternal(CLANGD_DOCS);
              }}
              className="inline-flex items-center gap-1 text-[11px] text-aether-accent hover:underline"
            >
              <ExternalLink size={11} />
              {t("doctor.openClangdDocs")}
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        title={t("doctor.dismiss")}
        aria-label={t("doctor.dismiss")}
        onClick={dismissDoctor}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
      >
        <X size={14} />
      </button>
    </div>
  );
}
