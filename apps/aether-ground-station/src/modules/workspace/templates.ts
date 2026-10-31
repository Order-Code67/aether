import type { WorkspaceLayout, WorkspaceTemplateId } from "@/types";

function now(): string {
  return new Date().toISOString();
}

function panel(
  id: string,
  kind: WorkspaceLayout["panels"][string]["kind"],
  title: string,
  weight = 1,
): WorkspaceLayout["panels"][string] {
  return { id, kind, title, visible: true, weight };
}

export function createTemplateLayout(
  template: WorkspaceTemplateId,
  name?: string,
): WorkspaceLayout {
  const id = `ws_${template}_${Date.now().toString(36)}`;
  const base = {
    id,
    name: name ?? templateLabel(template),
    template,
    updatedAt: now(),
    eventLogHeight: 140,
    eventLogVisible: true,
    deviceRailWidth: 280,
    deviceRailVisible: true,
  };

  switch (template) {
    case "video":
      return {
        ...base,
        columns: [["p_video", "p_walksnail"], ["p_devices"]],
        panels: {
          p_video: panel("p_video", "video", "Видео", 2),
          p_walksnail: panel("p_walksnail", "walksnail", "Walksnail", 2),
          p_devices: panel("p_devices", "devices", "Устройства", 1),
        },
        deviceRailVisible: false,
      };
    case "map":
      return {
        ...base,
        columns: [["p_map"], ["p_devices", "p_telemetry"]],
        panels: {
          p_map: panel("p_map", "map", "Карта", 3),
          p_devices: panel("p_devices", "devices", "Устройства", 1),
          p_telemetry: panel("p_telemetry", "telemetry", "Диагностика", 1),
        },
      };
    case "engineering":
      return {
        ...base,
        columns: [
          ["p_serial", "p_usb"],
          ["p_network", "p_telemetry"],
          ["p_devices"],
        ],
        panels: {
          p_serial: panel("p_serial", "serial", "COM / UART"),
          p_usb: panel("p_usb", "usb", "USB"),
          p_network: panel("p_network", "network", "Сеть"),
          p_telemetry: panel("p_telemetry", "telemetry", "Диагностика"),
          p_devices: panel("p_devices", "devices", "Устройства"),
        },
      };
    case "custom":
      return {
        ...base,
        columns: [["p_empty"]],
        panels: {
          p_empty: panel("p_empty", "empty", "Пользовательская панель"),
        },
        deviceRailVisible: false,
        eventLogVisible: true,
      };
    case "standard":
    default:
      return {
        ...base,
        name: name ?? "Стандартный",
        template: "standard",
        columns: [["p_video", "p_map"], ["p_devices", "p_telemetry"]],
        panels: {
          p_video: panel("p_video", "video", "Видео", 2),
          p_map: panel("p_map", "map", "Карта", 2),
          p_devices: panel("p_devices", "devices", "Устройства", 1),
          p_telemetry: panel("p_telemetry", "telemetry", "Диагностика", 1),
        },
      };
  }
}

export function templateLabel(id: WorkspaceTemplateId): string {
  switch (id) {
    case "standard":
      return "Стандартный";
    case "video":
      return "Видеонаблюдение";
    case "map":
      return "Карта";
    case "engineering":
      return "Инженерный";
    case "custom":
      return "Пользовательский";
  }
}

export const WORKSPACE_TEMPLATES: WorkspaceTemplateId[] = [
  "standard",
  "video",
  "map",
  "engineering",
  "custom",
];
