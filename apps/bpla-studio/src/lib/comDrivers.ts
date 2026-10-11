import type { Locale } from "@/i18n";
import { openUrl } from "@tauri-apps/plugin-opener";
import { isTauriRuntime } from "@/lib/tauri";

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
    lower.includes("порт занят")
  ) {
    return "access_denied";
  }
  if (lower.includes("not found") || lower.includes("no such file")) {
    return "port_not_found";
  }
  if (lower.includes("failed to open") || lower.includes("could not open")) {
    return "open_failed";
  }
  return null;
}

export async function openExternalUrl(url: string): Promise<void> {
  if (!isTauriRuntime()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  await openUrl(url);
}

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
            body: "Проверьте кабель/USB и драйвер CH340 или CP210x.",
          }
        : {
            title: "No COM ports listed",
            body: "Check cable/USB and install a CH340 or CP210x driver.",
          };
    case "access_denied":
      return ru
        ? {
            title: "Порт не открывается",
            body: "Закройте Aether Serial Monitor и другие программы на этом COM.",
          }
        : {
            title: "Port will not open",
            body: "Close Aether Serial Monitor and other apps using this COM port.",
          };
    case "port_not_found":
      return ru
        ? { title: "COM-порт не найден", body: "Подключите плату и обновите список." }
        : {
            title: "Serial port not found",
            body: "Connect the board and refresh ports.",
          };
    case "open_failed":
      return ru
        ? {
            title: "Не удалось открыть COM-порт",
            body: "Проверьте драйвер CH340/CP210x.",
          }
        : {
            title: "Could not open the COM port",
            body: "Check the CH340/CP210x driver.",
          };
  }
}
