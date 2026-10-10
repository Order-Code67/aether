import type { Locale } from "@/i18n";

/** Map common PlatformIO / esptool / avrdude errors to clearer RU/EN messages. */
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
      ? "Не найден PlatformIO CLI. Нажмите «Установить недостающее» или установите PlatformIO Core и перезапустите Aether."
      : "PlatformIO CLI not found. Use Install missing, or install PlatformIO Core and restart Aether.";
  }
  if (
    lower.includes("python not found") ||
    lower.includes("no module named pip") ||
    lower.includes("pip is not recognized")
  ) {
    return ru
      ? "Не найден Python/pip. Установите Python 3 с python.org (отметьте pip и Add to PATH), затем повторите установку PlatformIO."
      : "Python/pip not found. Install Python 3 from python.org (enable pip and Add to PATH), then retry PlatformIO install.";
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

  // Port busy / Access denied
  if (
    lower.includes("access is denied") ||
    lower.includes("permission denied") ||
    lower.includes("resource busy") ||
    lower.includes("device or resource busy") ||
    lower.includes("being used by another") ||
    lower.includes("oserror: [errno 13]") ||
    lower.includes("errno 16") ||
    (lower.includes("could not open") && lower.includes("busy"))
  ) {
    return ru
      ? "Порт занят или доступ запрещён. Закройте Serial Monitor и другие программы, использующие этот COM-порт, затем повторите загрузку."
      : "Port busy or access denied. Close Serial Monitor and other apps using this COM port, then retry upload.";
  }

  // Failed to open serial / no driver
  if (
    lower.includes("failed to open") ||
    lower.includes("could not open port") ||
    (lower.includes("could not open") &&
      (lower.includes("port") ||
        lower.includes("com") ||
        lower.includes("serial"))) ||
    lower.includes("serialexception") ||
    (lower.includes("no such file or directory") && lower.includes("tty")) ||
    (lower.includes("the system cannot find the file specified") &&
      (lower.includes("com") || lower.includes("port"))) ||
    lower.includes("cannot configure port") ||
    lower.includes("device not configured") ||
    lower.includes("the device does not recognize the command") ||
    lower.includes("a device attached to the system is not functioning") ||
    lower.includes("device cannot be started") ||
    lower.includes("error code 43") ||
    lower.includes("error code 10")
  ) {
    return ru
      ? "Не удалось открыть COM-порт. Проверьте кабель, установите драйвер CH340/CP210x (см. подсказку у Serial / при загрузке) и выберите правильный порт."
      : "Could not open the serial port. Check the cable, install CH340/CP210x drivers (see the help near Serial / Upload), and select the correct port.";
  }

  // Port not found
  if (
    lower.includes("port not found") ||
    (lower.includes("could not find") && lower.includes("port")) ||
    lower.includes("no serial ports found") ||
    lower.includes("upload_port") ||
    (lower.includes("please specify") && lower.includes("port")) ||
    lower.includes("no device found") ||
    (lower.includes("auto-detected upload port") && lower.includes("none"))
  ) {
    return ru
      ? "COM-порт не найден. Подключите плату, обновите список портов и выберите нужный в панели сборки."
      : "Serial port not found. Connect the board, refresh ports, and select one in the build toolbar.";
  }

  // Wrong board / sync failed
  if (
    lower.includes("failed to connect") ||
    lower.includes("timed out waiting for packet header") ||
    lower.includes("invalid head of packet") ||
    lower.includes("wrong boot mode") ||
    lower.includes("no sync") ||
    lower.includes("not in sync") ||
    lower.includes("stk500") ||
    lower.includes("esp_stub") && lower.includes("fail") ||
    lower.includes("chip sync failed") ||
    lower.includes("failed to enter") && lower.includes("download") ||
    lower.includes("error: unknown board") ||
    lower.includes("unknown board id")
  ) {
    return ru
      ? "Нет связи с платой (ошибка синхронизации). Проверьте выбранную плату/окружение, зажмите BOOT при загрузке (ESP32) и смените кабель/порт."
      : "Board sync failed. Check the selected board/env, hold BOOT while uploading (ESP32), and try another cable/port.";
  }

  if (lower.includes("open a platformio project") || lower.includes("folder first")) {
    return ru
      ? "Сначала откройте папку проекта PlatformIO."
      : "Open a PlatformIO project folder first.";
  }
  if (lower.includes("upload failed") || lower.includes("*** [upload] error")) {
    return ru
      ? "Загрузка не удалась. Проверьте COM-порт, кабель, драйвер и выбранную плату."
      : "Upload failed. Check the COM port, cable, driver, and selected board.";
  }
  if (
    lower.includes("cancelled") ||
    lower === "cancelled"
  ) {
    return ru ? "Задача отменена." : "Task cancelled.";
  }

  return m;
}
