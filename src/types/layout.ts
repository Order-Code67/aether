import type { MessageKey } from "@/i18n";

export type ActivityId =
  | "explorer"
  | "search"
  | "source-control"
  | "boards"
  | "libraries"
  | "inav"
  | "debug"
  | "agent"
  | "extensions";

export type BottomPanelTab =
  | "problems"
  | "output"
  | "debug"
  | "serial"
  | "plotter"
  | "camera"
  | "terminal";

export interface ActivityItem {
  id: ActivityId;
  labelKey: MessageKey;
  titleKey: MessageKey;
}

export const ACTIVITY_ITEMS: readonly ActivityItem[] = [
  {
    id: "explorer",
    labelKey: "activity.explorer",
    titleKey: "activity.explorer",
  },
  { id: "search", labelKey: "activity.search", titleKey: "activity.search" },
  {
    id: "source-control",
    labelKey: "activity.sourceControl",
    titleKey: "activity.sourceControl",
  },
  { id: "boards", labelKey: "activity.boards", titleKey: "activity.boards" },
  {
    id: "libraries",
    labelKey: "activity.libraries",
    titleKey: "activity.librariesTitle",
  },
  {
    id: "inav",
    labelKey: "activity.inav",
    titleKey: "activity.inavTitle",
  },
  { id: "debug", labelKey: "activity.debug", titleKey: "activity.debug" },
  { id: "agent", labelKey: "activity.agent", titleKey: "activity.agent" },
  {
    id: "extensions",
    labelKey: "activity.extensions",
    titleKey: "activity.extensions",
  },
] as const;

export const BOTTOM_PANEL_TABS: readonly {
  id: BottomPanelTab;
  labelKey: MessageKey;
}[] = [
  { id: "problems", labelKey: "panel.problems" },
  { id: "output", labelKey: "panel.output" },
  { id: "debug", labelKey: "panel.debug" },
  { id: "serial", labelKey: "panel.serial" },
  { id: "plotter", labelKey: "panel.plotter" },
  { id: "camera", labelKey: "panel.camera" },
  { id: "terminal", labelKey: "panel.terminal" },
] as const;
