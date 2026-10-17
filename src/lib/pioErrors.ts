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
      ? "Задача сборки уже выполняется."
      : "A firmware task is already running.";
  }
  if (
    lower.includes("arduino-cli not found") ||
    lower.includes("arduino cli not found")
  ) {
    return ru
      ? "Не найден arduino-cli. Установите через Настройки → Инструменты или переключите сборку на PlatformIO."
      : "arduino-cli not found. Install via Settings → Tools, or switch Build tool to PlatformIO.";
  }
  if (lower.includes("no .ino sketch")) {
    return ru
      ? "Нет файла .ino. Arduino CLI нужен скетч .ino (корень или src/). Для проектов только с .cpp используйте PlatformIO."
      : "No .ino sketch found. Arduino CLI needs a .ino (root or src/). Use PlatformIO for .cpp-only projects.";
  }
  if (
    lower.includes("no arduino fqbn mapping") ||
    (lower.includes("fqbn") && lower.includes("mapping"))
  ) {
    const boardMatch = m.match(/board ['"]?([^'".\n]+)['"]?/i);
    const board = boardMatch?.[1]?.trim();
    if (ru) {
      return board
        ? `Нет соответствия FQBN для платы «${board}». Переключите инструмент сборки на PlatformIO или выберите распространённую плату (uno, megaatmega2560, esp32dev…).`
        : "Нет соответствия FQBN для этой платы. Переключите инструмент сборки на PlatformIO или выберите распространённую плату Arduino/ESP (uno, megaatmega2560, esp32dev…).";
    }
    return board
      ? `No Arduino FQBN mapping for board "${board}". Switch Build tool to PlatformIO, or use a common Arduino/ESP board (uno, megaatmega2560, esp32dev…).`
      : "No Arduino FQBN mapping for this board. Switch Build tool to PlatformIO, or use a common Arduino/ESP board (uno, megaatmega2560, esp32dev…).";
  }
  if (
    lower.includes("could not read board=") ||
    lower.includes("could not read board")
  ) {
    return ru
      ? "Не удалось прочитать board= из platformio.ini для Arduino CLI. Укажите плату в ini или переключитесь на PlatformIO."
      : "Could not read board= from platformio.ini for Arduino CLI. Set board= in the ini, or switch to PlatformIO.";
  }
  if (
    lower.includes("failed to install arduino core") ||
    lower.includes("arduino-cli core install failed")
  ) {
    return ru
      ? "Не удалось установить ядро Arduino CLI (avr/esp32). Проверьте сеть или установите вручную: arduino-cli core install arduino:avr / esp32:esp32."
      : "Failed to install Arduino CLI core (avr/esp32). Check the network, or install manually: arduino-cli core install arduino:avr / esp32:esp32.";
  }
  if (
    lower.includes("invalid offline cache zip") ||
    lower.includes("expected platforms/") ||
    lower.includes("no platforms or lib/")
  ) {
    return ru
      ? "Неверный архив офлайн-кэша. Нужен zip с platforms/… и/или lib/ (см. docs/OFFLINE_INSTALLER.md)."
      : "Invalid offline cache zip. Need platforms/… and/or lib/ (see docs/OFFLINE_INSTALLER.md).";
  }
  if (
    lower.includes("offline cache zip not found") ||
    lower.includes("must be a .zip")
  ) {
    return ru
      ? "Выберите файл .zip офлайн-кэша Aether."
      : "Pick an Aether offline-cache .zip file.";
  }
  if (lower.includes("path traversal")) {
    return ru
      ? "Архив отклонён: небезопасные пути внутри zip."
      : "Zip rejected: unsafe paths inside the archive.";
  }
  if (lower.includes("could not resolve platformio home")) {
    return ru
      ? "Не удалось определить папку ~/.platformio."
      : "Could not resolve PlatformIO home (~/.platformio).";
  }
  if (
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    lower.includes("offline or slow registry")
  ) {
    return ru
      ? "Таймаут PlatformIO (офлайн или медленный реестр). Проверьте сеть или используйте офлайн-кэш."
      : "PlatformIO timed out (offline or slow registry). Check the network or use the offline cache.";
  }

  // Port busy / Access denied
  if (
    lower.includes("access is denied") ||
    lower.includes("access denied") ||
    lower.includes("permission denied") ||
    lower.includes("resource busy") ||
    lower.includes("device or resource busy") ||
    lower.includes("being used by another") ||
    lower.includes("oserror: [errno 13]") ||
    lower.includes("errno 16") ||
    (lower.includes("could not open") && lower.includes("busy")) ||
    lower.includes("port busy")
  ) {
    return ru
      ? "Порт занят или доступ запрещён. Закройте Arduino IDE, другие Serial Monitor и программы, использующие этот COM-порт, затем повторите загрузку. Если ошибка остаётся — проверьте кабель и баннер с драйверами CH340/CP210x."
      : "Port busy or access denied. Close Arduino IDE, other Serial Monitors, and apps using this COM port, then retry upload. If it persists, check the cable and the CH340/CP210x driver banner.";
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
      ? "Не удалось открыть COM-порт. Закройте Arduino IDE и другие Serial Monitor, проверьте кабель, установите драйвер CH340/CP210x (баннер у Serial / при загрузке) и выберите правильный порт."
      : "Could not open the serial port. Close Arduino IDE and other Serial Monitors, check the cable, install CH340/CP210x drivers (banner near Serial / Upload), and select the correct port.";
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
