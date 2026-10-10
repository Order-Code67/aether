import type { Locale } from "@/i18n";

/** Map common PlatformIO / toolchain errors to clearer RU/EN messages. */
export function friendlyPioError(message: string, locale: Locale): string {
  const m = message.trim();
  const ru = locale === "ru";
  const lower = m.toLowerCase();

  if (
    lower.includes("platformio cli not found") ||
    lower.includes("pio` is on path") ||
    lower.includes("ensure `pio`")
  ) {
    return ru
      ? "Не найден PlatformIO CLI. Установите PlatformIO Core и перезапустите Aether."
      : "PlatformIO CLI not found. Install PlatformIO Core and restart Aether.";
  }
  if (lower.includes("no platformio.ini")) {
    return ru
      ? "В корне рабочей папки нет platformio.ini."
      : "No platformio.ini in the workspace root.";
  }
  if (lower.includes("already running")) {
    return ru
      ? "Задача PlatformIO уже выполняется."
      : "A PlatformIO task is already running.";
  }
  if (
    lower.includes("could not open") &&
    (lower.includes("port") || lower.includes("com") || lower.includes("serial"))
  ) {
    return ru
      ? "Не удалось открыть порт. Закройте Serial Monitor и выберите другой COM-порт."
      : "Could not open the port. Close Serial Monitor and pick another COM port.";
  }
  if (
    lower.includes("upload_port") ||
    (lower.includes("please specify") && lower.includes("port")) ||
    lower.includes("no device found") ||
    lower.includes("failed to connect")
  ) {
    return ru
      ? "Плата не найдена. Выберите COM-порт в панели сборки и подключите устройство."
      : "Board not found. Select a COM port in the build toolbar and connect the device.";
  }
  if (lower.includes("permission denied") || lower.includes("access is denied")) {
    return ru
      ? "Нет доступа к порту. Закройте другие программы, использующие этот COM-порт."
      : "Port access denied. Close other programs using this COM port.";
  }
  if (lower.includes("open a platformio project") || lower.includes("folder first")) {
    return ru
      ? "Сначала откройте папку проекта PlatformIO."
      : "Open a PlatformIO project folder first.";
  }
  if (lower.includes("upload failed") || lower.includes("error: unknown board")) {
    return ru
      ? "Загрузка не удалась. Проверьте COM-порт, кабель и выбранную плату."
      : "Upload failed. Check the COM port, cable, and selected board.";
  }

  return m;
}
