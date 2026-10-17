import type { MessageKey } from "@/i18n";

export type ActivityId =
  | "explorer"
  | "sources"
  | "search"
  | "source-control"
  | "boards"
  | "libraries"
  | "doctor"
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
    titleKey: "activity.explorerTitle",
  },
  {
    id: "sources",
    labelKey: "activity.sources",
    titleKey: "activity.sourcesTitle",
  },
  {
    id: "search",
    labelKey: "activity.search",
    titleKey: "activity.searchTitle",
  },
  {
    id: "source-control",
    labelKey: "activity.sourceControl",
    titleKey: "activity.sourceControlTitle",
  },
  {
    id: "boards",
    labelKey: "activity.boards",
    titleKey: "activity.boardsTitle",
  },
  {
    id: "libraries",
    labelKey: "activity.libraries",
    titleKey: "activity.librariesTitle",
  },
  {
    id: "doctor",
    labelKey: "activity.doctor",
    titleKey: "activity.doctorTitle",
  },
  {
    id: "inav",
    labelKey: "activity.inav",
    titleKey: "activity.inavTitle",
  },
  {
    id: "debug",
    labelKey: "activity.debug",
    titleKey: "activity.debugTitle",
  },
  {
    id: "agent",
    labelKey: "activity.agent",
    titleKey: "activity.agentTitle",
  },
  {
    id: "extensions",
    labelKey: "activity.extensions",
    titleKey: "activity.extensionsTitle",
  },
] as const;

export const BOTTOM_PANEL_TABS: readonly {
  id: BottomPanelTab;
  labelKey: MessageKey;
  titleKey: MessageKey;
}[] = [
  {
    id: "problems",
    labelKey: "panel.problems",
    titleKey: "panel.problemsTitle",
  },
  { id: "output", labelKey: "panel.output", titleKey: "panel.outputTitle" },
  { id: "debug", labelKey: "panel.debug", titleKey: "panel.debugTitle" },
  { id: "serial", labelKey: "panel.serial", titleKey: "panel.serialTitle" },
  {
    id: "plotter",
    labelKey: "panel.plotter",
    titleKey: "panel.plotterTitle",
  },
  { id: "camera", labelKey: "panel.camera", titleKey: "panel.cameraTitle" },
  {
    id: "terminal",
    labelKey: "panel.terminal",
    titleKey: "panel.terminalTitle",
  },
] as const;
