/** Идентификаторы модулей платформы (v0.2). */
export type ModuleId =
  | "workspace"
  | "video"
  | "walksnail"
  | "map"
  | "devices"
  | "network"
  | "usb"
  | "serial"
  | "telemetry"
  | "archive"
  | "profiles"
  | "remote"
  | "settings";

export interface ModuleDefinition {
  id: ModuleId;
  label: string;
  stage: number;
  description: string;
}

export const MODULES: readonly ModuleDefinition[] = [
  {
    id: "workspace",
    label: "Рабочее пространство",
    stage: 3,
    description: "Настраиваемые панели и шаблоны компоновки",
  },
  {
    id: "video",
    label: "Видео",
    stage: 5,
    description: "Универсальный видеозахват и панели",
  },
  {
    id: "walksnail",
    label: "Walksnail",
    stage: 5,
    description: "Адаптер видео Walksnail через захват HDMI/USB",
  },
  {
    id: "map",
    label: "Карта",
    stage: 6,
    description: "MapLibre, OSM, рельеф и метки",
  },
  {
    id: "devices",
    label: "Устройства",
    stage: 8,
    description: "Device Manager и карточки оборудования",
  },
  {
    id: "network",
    label: "Сеть",
    stage: 4,
    description: "Ethernet и диагностика сети",
  },
  {
    id: "usb",
    label: "USB",
    stage: 4,
    description: "Обнаружение и подключение USB",
  },
  {
    id: "serial",
    label: "COM / UART",
    stage: 4,
    description: "Поиск COM-портов и обмен данными",
  },
  {
    id: "telemetry",
    label: "Диагностика",
    stage: 7,
    description: "ESP32 / Arduino и JSON-телеметрия",
  },
  {
    id: "archive",
    label: "Архив",
    stage: 10,
    description: "Видеозаписи и журнал событий",
  },
  {
    id: "profiles",
    label: "Профили",
    stage: 9,
    description: "Профили комплексов наземных станций",
  },
  {
    id: "remote",
    label: "Удалённо",
    stage: 13,
    description: "Remote Connectivity — архитектура и API (v0.3)",
  },
  {
    id: "settings",
    label: "Настройки",
    stage: 2,
    description: "Конфигурация приложения",
  },
] as const;

export interface AppInfo {
  name: string;
  version: string;
  stage: string;
  platform: string;
}
