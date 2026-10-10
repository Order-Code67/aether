import { documentDir, join } from "@tauri-apps/api/path";
import { save } from "@tauri-apps/plugin-dialog";
import { mkdir, writeTextFile } from "@tauri-apps/plugin-fs";
import type { Locale } from "@/i18n";
import { isTauriRuntime } from "@/lib/tauri";
import { useLspStore } from "@/stores/lspStore";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useSerialStore } from "@/stores/serialStore";

export type SupportReportSnapshot = {
  aetherVersion: string;
  os: string;
  locale: Locale;
  pioInstalled: boolean;
  pioVersion: string | null;
  selectedEnv: string;
  uploadPort: string;
  lastTask: string | null;
  lastSuccess: boolean | null;
  lastError: string | null;
  lastOutputTail: string;
  clangdInstalled: boolean;
  clangdVersion: string | null;
  clangdRunning: boolean;
  clangdError: string | null;
};

function labels(locale: Locale) {
  if (locale === "ru") {
    return {
      title: "Отчёт поддержки Aether",
      version: "Версия Aether",
      os: "ОС",
      locale: "Язык",
      pio: "PlatformIO",
      pioInstalled: "установлен",
      pioMissing: "не установлен",
      env: "Окружение (env)",
      port: "Порт загрузки",
      lastTask: "Последняя задача",
      lastResult: "Результат",
      success: "успех",
      failure: "ошибка",
      unknown: "н/д",
      lastError: "Последняя ошибка",
      output: "Хвост вывода",
      clangd: "clangd",
      clangdMissing: "не установлен",
      running: "запущен",
      stopped: "остановлен",
      none: "—",
    };
  }
  return {
    title: "Aether support report",
    version: "Aether version",
    os: "OS",
    locale: "Locale",
    pio: "PlatformIO",
    pioInstalled: "installed",
    pioMissing: "not installed",
    env: "Selected env",
    port: "Upload port",
    lastTask: "Last task",
    lastResult: "Last result",
    success: "success",
    failure: "failure",
    unknown: "n/a",
    lastError: "Last error",
    output: "Output tail",
    clangd: "clangd",
    clangdMissing: "not installed",
    running: "running",
    stopped: "stopped",
    none: "—",
  };
}

export function formatSupportReport(snap: SupportReportSnapshot): string {
  const L = labels(snap.locale);
  const pioLine = snap.pioInstalled
    ? `${L.pioInstalled}${snap.pioVersion ? ` (${snap.pioVersion})` : ""}`
    : L.pioMissing;
  const result =
    snap.lastSuccess === true
      ? L.success
      : snap.lastSuccess === false
        ? L.failure
        : L.unknown;
  const clangdLine = snap.clangdInstalled
    ? `${snap.clangdVersion ?? L.unknown}; ${snap.clangdRunning ? L.running : L.stopped}${
        snap.clangdError ? `; ${snap.clangdError}` : ""
      }`
    : L.clangdMissing;

  const lines = [
    L.title,
    `${L.version}: ${snap.aetherVersion}`,
    `${L.os}: ${snap.os}`,
    `${L.locale}: ${snap.locale}`,
    `${L.pio}: ${pioLine}`,
    `${L.env}: ${snap.selectedEnv || L.none}`,
    `${L.port}: ${snap.uploadPort || L.none}`,
    `${L.lastTask}: ${snap.lastTask ?? L.none}`,
    `${L.lastResult}: ${result}`,
    `${L.lastError}: ${snap.lastError ?? L.none}`,
    `${L.clangd}: ${clangdLine}`,
    "",
    `${L.output}:`,
    snap.lastOutputTail || L.none,
  ];
  return lines.join("\n");
}

function detectOs(): string {
  try {
    const ua = navigator.userAgent || "";
    const platform = navigator.platform || "";
    return `${platform || "unknown"} | ${ua}`.slice(0, 240);
  } catch {
    return "unknown";
  }
}

async function resolveAppVersion(): Promise<string> {
  if (isTauriRuntime()) {
    try {
      const { getVersion } = await import("@tauri-apps/api/app");
      return await getVersion();
    } catch {
      // fall through
    }
  }
  return "unknown";
}

export async function collectSupportReport(
  locale: Locale,
): Promise<SupportReportSnapshot> {
  const pio = usePlatformIoStore.getState();
  const lsp = useLspStore.getState();
  const serial = useSerialStore.getState();

  const uploadPort = pio.getUploadPort().trim() || serial.selectedPath || "";

  const tail = pio.lines
    .slice(-40)
    .map((l) => l.text)
    .join("\n")
    .slice(0, 3500);

  return {
    aetherVersion: await resolveAppVersion(),
    os: detectOs(),
    locale,
    pioInstalled: Boolean(pio.info?.installed ?? pio.doctor.pio?.installed),
    pioVersion: pio.info?.version ?? pio.doctor.pio?.version ?? null,
    selectedEnv: pio.selectedEnv || "",
    uploadPort,
    lastTask: pio.lastTask,
    lastSuccess: pio.lastSuccess,
    lastError: pio.error,
    lastOutputTail: tail,
    clangdInstalled: Boolean(lsp.info?.installed ?? pio.doctor.clangd?.installed),
    clangdVersion:
      lsp.info?.version ?? pio.doctor.clangd?.version ?? null,
    clangdRunning: Boolean(lsp.status.running),
    clangdError: lsp.error ?? lsp.status.error,
  };
}

export async function buildSupportReportText(locale: Locale): Promise<string> {
  return formatSupportReport(await collectSupportReport(locale));
}

function reportTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/** Default path: Documents/Aether/logs/aether-report-TIMESTAMP.txt */
export async function defaultSupportReportPath(): Promise<string> {
  const docs = await documentDir();
  return await join(
    docs,
    "Aether",
    "logs",
    `aether-report-${reportTimestamp()}.txt`,
  );
}

async function ensureAetherLogsDir(): Promise<string> {
  const docs = await documentDir();
  const dir = await join(docs, "Aether", "logs");
  await mkdir(dir, { recursive: true });
  return dir;
}

/** Write support report (+ output tail) via save dialog; default under Documents/Aether/logs. */
export async function saveSupportReportToDisk(
  locale: Locale,
): Promise<string | null> {
  if (!isTauriRuntime()) {
    throw new Error("Saving a support report requires the desktop app.");
  }
  const text = await buildSupportReportText(locale);
  const suggested = await defaultSupportReportPath();
  const chosen = await save({
    title: locale === "ru" ? "Сохранить отчёт поддержки" : "Save support report",
    defaultPath: suggested,
    filters: [{ name: "Text", extensions: ["txt"] }],
  });
  if (typeof chosen !== "string" || !chosen) return null;
  const parent = chosen.replace(/[/\\][^/\\]+$/, "");
  if (parent && parent !== chosen) {
    try {
      await mkdir(parent, { recursive: true });
    } catch {
      // parent may already exist
    }
  }
  await writeTextFile(chosen, text);
  return chosen;
}

/** Best-effort: overwrite Documents/Aether/logs/last-error.txt after build/upload failure. */
export async function persistLastErrorReport(locale: Locale): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const text = await buildSupportReportText(locale);
    const dir = await ensureAetherLogsDir();
    const path = await join(dir, "last-error.txt");
    await writeTextFile(path, text);
  } catch {
    // best-effort — never surface as a secondary failure
  }
}
