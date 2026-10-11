import type { Locale } from "@/i18n";

/**
 * Known release notes for the update dialog. Prefer feed `body` when present;
 * map to Russian when locale is ru for versions we ship notes for.
 */
const NOTES_BY_VERSION: Record<string, { en: string; ru: string }> = {
  "0.2.20": {
    en: "MAVLink telemetry HUD (GPS, battery, VFR_HUD), ESP32-CAM /stream + 5V power hints.",
    ru: "HUD телеметрии MAVLink (GPS, батарея, VFR_HUD), ESP32-CAM /stream и подсказки про питание 5 В.",
  },
  "0.2.19": {
    en: "Playwright E2E smoke (Vite preview), expanded UI smoke checklist, Vitest contracts via test:contracts.",
    ru: "Playwright E2E smoke (Vite preview), расширенный UI smoke-чеклист, Vitest-контракты через test:contracts.",
  },
  "0.2.18": {
    en: "Firmware profile export/import, Plotter zoom & CSV, Camera save/record + reconnect, Debug watches & conditional breakpoints.",
    ru: "Экспорт/импорт профилей прошивки, зум и CSV в плоттере, сохранение/запись камеры с переподключением, watches и условные точки останова.",
  },

  "0.2.17": {
    en: "Quick Start on first launch, real Beta update channel, Settings Editor/Agent i18n, Arduino libraries via arduino-cli.",
    ru: "Быстрый старт при первом запуске, реальный канал Beta, i18n вкладок Editor/Agent, библиотеки Arduino через arduino-cli.",
  },
  "0.2.15": {
    en: "Offline PlatformIO cache import zip, Stable/Beta update channels.",
    ru: "Импорт офлайн-кэша PlatformIO из zip, каналы обновлений Stable/Beta.",
  },
  "0.2.14": {
    en: "ESP32-CAM Camera panel, MAVLink telemetry in Plotter, firmware profiles.",
    ru: "Панель камеры ESP32-CAM, телеметрия MAVLink в плоттере, профили прошивки.",
  },
  "0.2.13": {
    en: "E2E smoke suite, upload Access denied retry, Save Support Report to disk and last-error log.",
    ru: "E2E smoke-набор, повтор загрузки при Access denied, сохранение отчёта поддержки на диск и last-error лог.",
  },
  "0.2.12": {
    en: "Quick start wizard, COM driver help, Arduino library tab, light theme and Arduino simplified UI.",
    ru: "Быстрый старт, подсказки по драйверам COM, вкладка Arduino в библиотеках, светлая тема и упрощённый режим Arduino.",
  },
  "0.2.11": {
    en: "Open in VS Code launch fix, generate .vscode config, Serial status bar clarity.",
    ru: "Исправление запуска Open in VS Code, генерация .vscode, понятнее статус Serial в строке состояния.",
  },
  "0.2.10": {
    en: "VS Code install/launch fix on Windows, detect status in Settings, clearer missing-install hints.",
    ru: "Исправление установки/запуска VS Code на Windows, статус в Настройках, понятные подсказки если не установлен.",
  },
  "0.2.9": {
    en: "Animated PCB welcome background, install libraries from GitHub, Open in VS Code with .vscode helpers.",
    ru: "Анимированный PCB-фон Welcome, установка библиотек с GitHub, Open in VS Code и генерация .vscode.",
  },
  "0.2.8": {
    en: "Serial Plotter, hardware profile examples, debug gutter/toolbar, multi-env switcher.",
    ru: "Serial Plotter, примеры профилей железа, отладочный gutter/toolbar, переключатель multi-env.",
  },
  "0.2.7": {
    en: "Focus stability with Vitest guards, Copy Support Report, quiet update check and RU changelog dialog.",
    ru: "Стабильность фокуса с Vitest-проверками, копирование отчёта поддержки, тихая проверка обновлений и RU changelog в диалоге.",
  },
  "0.2.6": {
    en: "Sketch mode, board/port memory, examples catalog, offline cache tools.",
    ru: "Режим скетча, память платы/порта, каталог примеров, инструменты офлайн-кэша.",
  },
  "0.2.5": {
    en: "Install missing tools, clearer upload progress/errors, library favorites.",
    ru: "Установка недостающих инструментов, понятнее прогресс/ошибки загрузки, избранное библиотек.",
  },
  "0.2.4": {
    en: "New Project wizard, Tools Doctor, clearer upload / COM port UX.",
    ru: "Мастер нового проекта, проверка инструментов, удобнее загрузка и COM-порт.",
  },
  "0.2.3": {
    en: "Bundled examples, library presets in example projects.",
    ru: "Встроенные примеры и пресеты библиотек в примерах проектов.",
  },
  "0.2.2": {
    en: "App icon branding fix.",
    ru: "Исправлена иконка приложения.",
  },
  "0.2.1": {
    en: "Icon update, typing/focus fixes, library manager improvements.",
    ru: "Обновление иконки, исправления ввода/фокуса, улучшения менеджера библиотек.",
  },
  "0.2.0": {
    en: "Russian/English i18n, sketch encryption, libraries, focus fixes.",
    ru: "Русский/английский, шифрование скетчей, библиотеки, исправления фокуса.",
  },
  "0.1.0": {
    en: "First Windows desktop release.",
    ru: "Первый выпуск для Windows.",
  },
};

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, "");
}

/** Localize updater feed notes; fall back to mapped changelog or raw body. */
export function localizeUpdateNotes(
  version: string | null | undefined,
  body: string | null | undefined,
  locale: Locale,
): string {
  const ver = version ? normalizeVersion(version) : "";
  const mapped = ver ? NOTES_BY_VERSION[ver] : undefined;
  if (locale === "ru") {
    if (mapped?.ru) return mapped.ru;
    if (body?.trim()) return body.trim();
    return "Доступно обновление. Подробности — в заметках к выпуску на GitHub.";
  }
  if (body?.trim()) return body.trim();
  if (mapped?.en) return mapped.en;
  return "An update is available. See GitHub release notes for details.";
}
