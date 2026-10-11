/**
 * OSD layout model — visual constructor with local persistence.
 * Full MSP OSD element maps vary widely; this keeps a portable layout + CLI export.
 */

export type OsdElementId =
  | "rssi"
  | "voltage"
  | "mah"
  | "timer"
  | "throttle"
  | "altitude"
  | "gps_sats"
  | "craft_name"
  | "flymode"
  | "crosshairs"
  | "warnings";

export interface OsdElement {
  id: OsdElementId;
  label: string;
  x: number;
  y: number;
  visible: boolean;
}

export const OSD_COLS = 30;
export const OSD_ROWS = 16;

export const OSD_CATALOG: { id: OsdElementId; label: string }[] = [
  { id: "rssi", label: "RSSI" },
  { id: "voltage", label: "Battery V" },
  { id: "mah", label: "mAh" },
  { id: "timer", label: "Timer" },
  { id: "throttle", label: "Throttle" },
  { id: "altitude", label: "Altitude" },
  { id: "gps_sats", label: "GPS sats" },
  { id: "craft_name", label: "Craft name" },
  { id: "flymode", label: "Fly mode" },
  { id: "crosshairs", label: "Crosshairs" },
  { id: "warnings", label: "Warnings" },
];

export function defaultOsdLayout(): OsdElement[] {
  return [
    { id: "rssi", label: "RSSI", x: 1, y: 1, visible: true },
    { id: "voltage", label: "Battery V", x: 1, y: 2, visible: true },
    { id: "mah", label: "mAh", x: 1, y: 3, visible: true },
    { id: "timer", label: "Timer", x: 22, y: 1, visible: true },
    { id: "flymode", label: "Fly mode", x: 12, y: 1, visible: true },
    { id: "crosshairs", label: "Crosshairs", x: 14, y: 7, visible: true },
    { id: "gps_sats", label: "GPS sats", x: 1, y: 14, visible: true },
    { id: "altitude", label: "Altitude", x: 22, y: 14, visible: true },
    { id: "craft_name", label: "Craft name", x: 10, y: 14, visible: false },
    { id: "throttle", label: "Throttle", x: 22, y: 2, visible: false },
    { id: "warnings", label: "Warnings", x: 8, y: 3, visible: true },
  ];
}

/** Best-effort CLI export for documentation / paste into BF CLI. */
export function formatOsdCliExport(elements: OsdElement[]): string {
  const lines = [
    "# Aether OSD layout export (review before applying)",
    `# cols=${OSD_COLS} rows=${OSD_ROWS}`,
  ];
  for (const el of elements) {
    lines.push(
      `# ${el.id} visible=${el.visible ? 1 : 0} x=${el.x} y=${el.y}`,
    );
  }
  return lines.join("\n");
}
