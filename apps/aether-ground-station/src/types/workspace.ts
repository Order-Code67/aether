export type WorkspaceTemplateId =
  | "standard"
  | "video"
  | "map"
  | "engineering"
  | "custom";

export type PanelKind =
  | "video"
  | "walksnail"
  | "map"
  | "devices"
  | "telemetry"
  | "serial"
  | "network"
  | "usb"
  | "archive"
  | "events"
  | "empty";

export interface WorkspacePanel {
  id: string;
  kind: PanelKind;
  title: string;
  visible: boolean;
  /** Relative flex/grid weight */
  weight: number;
}

export interface WorkspaceLayout {
  id: string;
  name: string;
  template: WorkspaceTemplateId;
  updatedAt: string;
  /** Ordered columns; each column is a vertical stack of panel ids */
  columns: string[][];
  panels: Record<string, WorkspacePanel>;
  /** Bottom event log height in px */
  eventLogHeight: number;
  eventLogVisible: boolean;
  /** Right device rail width in px */
  deviceRailWidth: number;
  deviceRailVisible: boolean;
}

export const PANEL_KIND_LABELS: Record<PanelKind, string> = {
  video: "Видео",
  walksnail: "Walksnail",
  map: "Карта",
  devices: "Устройства",
  telemetry: "Диагностика",
  serial: "COM / UART",
  network: "Сеть",
  usb: "USB",
  archive: "Архив",
  events: "События",
  empty: "Пустая панель",
};
