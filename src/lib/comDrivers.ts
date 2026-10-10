import type { Locale } from "@/i18n";
import { openWindowsOptionalFeatures } from "@/lib/platformio";

export const CH340_DRIVERS_URL =
  "https://www.wch-ic.com/downloads/CH341SER_EXE.html";
export const CP210X_DRIVERS_URL =
  "https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers";

export type ComDriverIssueKind =
  | "empty_ports"
  | "access_denied"
  | "port_not_found"
  | "open_failed"
  | null;

/** Classify serial / upload failures for driver help UI. */
export function classifyComDriverIssue(
  message: string | null | undefined,
  options?: { portsEmpty?: boolean },
): ComDriverIssueKind {
  if (options?.portsEmpty) return "empty_ports";
  if (!message) return null;
  const lower = message.trim().toLowerCase();
  if (!lower) return null;

  if (
    lower.includes("access is denied") ||
    lower.includes("permission denied") ||
    lower.includes("resource busy") ||
    lower.includes("device or resource busy") ||
    lower.includes("being used by another") ||
    lower.includes("oserror: [errno 13]") ||
    lower.includes("errno 16") ||
    (lower.includes("could not open") && lower.includes("busy")) ||
    lower.includes("порт занят") ||
    lower.includes("доступ запрещён") ||
    lower.includes("port busy or access denied")
  ) {
    return "access_denied";
  }

  if (
    lower.includes("port not found") ||
    (lower.includes("could not find") && lower.includes("port")) ||
    lower.includes("no serial ports found") ||
    lower.includes("no device found") ||
    (lower.includes("auto-detected upload port") && lower.includes("none")) ||
    lower.includes("com-порт не найден") ||
    lower.includes("serial port not found") ||
    (lower.includes("the system cannot find the file specified") &&
      (lower.includes("com") || lower.includes("port")))
  ) {
    return "port_not_found";
  }

  if (
    lower.includes("failed to open") ||
    lower.includes("could not open port") ||
    (lower.includes("could not open") &&
      (lower.includes("port") ||
        lower.includes("com") ||
        lower.includes("serial"))) ||
    lower.includes("serialexception") ||
    (lower.includes("no such file or directory") && lower.includes("tty")) ||
    lower.includes("cannot configure port") ||
    lower.includes("device not configured") ||
    lower.includes("не удалось открыть com") ||
    lower.includes("could not open the serial port") ||
    lower.includes("the device does not recognize the command") ||
    lower.includes("a device attached to the system is not functioning") ||
    lower.includes("device cannot be started") ||
    lower.includes("error code 43") ||
    lower.includes("error code 10")
  ) {
    return "open_failed";
  }

  return null;
}

export function isWindowsPlatform(): boolean {
  return (
    typeof navigator !== "undefined" &&
    /windows/i.test(navigator.userAgent || navigator.platform || "")
  );
}

export async function openExternalUrl(url: string): Promise<void> {
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export async function openOptionalFeaturesSafe(): Promise<void> {
  try {
    await openWindowsOptionalFeatures();
  } catch {
    await openExternalUrl("ms-settings:optionalfeatures");
  }
}

/** Short RU/EN copy for the banner body by issue kind. */
export function comDriverIssueBlurb(
  kind: Exclude<ComDriverIssueKind, null>,
  locale: Locale,
): { title: string; body: string } {
  const ru = locale === "ru";
  switch (kind) {
    case "empty_ports":
      return ru
        ? {
            title: "COM-портов нет в списке",
            body: "Плата не видна системе. Проверьте кабель/USB, затем установите драйвер CH340 или CP210x. Aether не ставит неподписанные драйверы автоматически.",
          }
        : {
            title: "No COM ports listed",
            body: "The board is not visible to the OS. Check the cable/USB, then install a CH340 or CP210x driver. Aether will not install unsigned drivers automatically.",
          };
    case "access_denied":
      return ru
        ? {
            title: "Порт есть, но не открывается",
            body: "Доступ запрещён или порт занят. Закройте Serial Monitor и другие программы, использующие этот COM-порт. Если ошибка остаётся — обновите драйвер CH340/CP210x.",
          }
        : {
            title: "Port exists but will not open",
            body: "Access denied or the port is busy. Close Serial Monitor and other apps using this COM port. If it persists, update the CH340/CP210x driver.",
          };
    case "port_not_found":
      return ru
        ? {
            title: "COM-порт не найден",
            body: "Подключите плату, обновите список портов и выберите нужный. Если порт не появляется — нужны драйверы CH340/CP210x.",
          }
        : {
            title: "Serial port not found",
            body: "Connect the board, refresh ports, and select one. If no port appears, install CH340/CP210x drivers.",
          };
    case "open_failed":
      return ru
        ? {
            title: "Не удалось открыть COM-порт",
            body: "Порт может отображаться в списке, но драйвер или кабель мешают открытию. Установите CH340/CP210x с сайта производителя (без «тихой» установки неподписанных драйверов).",
          }
        : {
            title: "Could not open the COM port",
            body: "The port may appear in the list but the driver or cable prevents opening it. Install CH340/CP210x from the vendor site (no silent unsigned driver install).",
          };
  }
}
