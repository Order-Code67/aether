import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, X } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { isTauriRuntime } from "@/lib/tauri";
import { usePlatformIoStore } from "@/stores/platformioStore";

const PIO_DOCS =
  "https://docs.platformio.org/en/latest/core/installation.html";
const CLANGD_DOCS = "https://clangd.llvm.org/installation.html";

async function openExternal(url: string) {
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/** Non-blocking startup check for PlatformIO / clangd (desktop only). */
export function ToolsDoctorBanner() {
  const { t } = useI18n();
  const doctor = usePlatformIoStore((s) => s.doctor);
  const dismissed = usePlatformIoStore((s) => s.doctorDismissed);
  const runDoctor = usePlatformIoStore((s) => s.runDoctor);
  const dismissDoctor = usePlatformIoStore((s) => s.dismissDoctor);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    void runDoctor();
  }, [runDoctor]);

  if (!isTauriRuntime() || !doctor.checked || dismissed) {
    return null;
  }

  // Hide when healthy after first check (still available via Recheck from menu later).
  if (doctor.ok) {
    return null;
  }

  const pio = doctor.pio;
  const clangd = doctor.clangd;
  const pioMissing = !pio?.installed;
  // clangd is optional — show warning style only when PIO is missing, else soft tip.
  const severity = pioMissing ? "warning" : "info";

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
              {!clangd?.installed
                ? t("doctor.clangdMissing")
                : t("doctor.clangdOk", {
                    version: clangd.version ?? "OK",
                  })}
            </li>
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            disabled={doctor.checking}
            onClick={() => {
              void runDoctor();
            }}
            className="rounded border border-aether-border bg-aether-bg px-2 py-0.5 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
          >
            {t("doctor.recheck")}
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
