import type { Locale } from "@/i18n";

/** Map raw debugger / pio debug failures to short, actionable copy. */
export function friendlyDebugError(message: string, locale: Locale): string {
  const lower = message.toLowerCase();
  const ru = locale === "ru";

  if (
    lower.includes("platformio cli not found") ||
    lower.includes("pio` is on path") ||
    (lower.includes("not found") && lower.includes("platformio"))
  ) {
    return ru
      ? "PlatformIO CLI не найден. Установите PlatformIO Core и убедитесь, что `pio` в PATH."
      : "PlatformIO CLI not found. Install PlatformIO Core and ensure `pio` is on PATH.";
  }

  if (
    lower.includes("debug_tool") ||
    lower.includes("unknown debug") ||
    lower.includes("no debug") ||
    lower.includes("debugging is not")
  ) {
    return ru
      ? "Отладчик/debug_tool не настроен. Укажите debug_tool в platformio.ini для этой платы и установите тулчейн (pio pkg install)."
      : "Debug tool missing. Set debug_tool in platformio.ini for this board and install the toolchain (pio pkg install).";
  }

  if (
    lower.includes("gdb") &&
    (lower.includes("not found") ||
      lower.includes("no such file") ||
      lower.includes("cannot find"))
  ) {
    return ru
      ? "GDB не найден. Соберите проект и установите пакет отладки PlatformIO для выбранного env."
      : "GDB not found. Build the project and install the PlatformIO debug package for the selected env.";
  }

  if (lower.includes("no platformio.ini")) {
    return ru
      ? "В корне рабочей папки нет platformio.ini."
      : "No platformio.ini in the workspace root.";
  }

  if (
    lower.includes("failed to start debugger") ||
    lower.includes("os error 2")
  ) {
    return ru
      ? "Не удалось запустить pio debug. Проверьте, что PlatformIO установлен и для env задан debug_tool."
      : "Could not start pio debug. Check that PlatformIO is installed and debug_tool is set for the env.";
  }

  return message;
}
