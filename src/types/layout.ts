export type ActivityId =
  | "explorer"
  | "search"
  | "source-control"
  | "boards"
  | "debug"
  | "agent"
  | "extensions";

export type BottomPanelTab =
  | "problems"
  | "output"
  | "debug"
  | "serial"
  | "terminal";

export interface ActivityItem {
  id: ActivityId;
  label: string;
  title: string;
}

export const ACTIVITY_ITEMS: readonly ActivityItem[] = [
  { id: "explorer", label: "Explorer", title: "Explorer" },
  { id: "search", label: "Search", title: "Search" },
  { id: "source-control", label: "Source Control", title: "Source Control" },
  { id: "boards", label: "Boards", title: "Boards & Targets" },
  { id: "debug", label: "Run and Debug", title: "Run and Debug" },
  { id: "agent", label: "Agent", title: "AI Agent" },
  { id: "extensions", label: "Extensions", title: "Extensions" },
] as const;

export const BOTTOM_PANEL_TABS: readonly {
  id: BottomPanelTab;
  label: string;
}[] = [
  { id: "problems", label: "Problems" },
  { id: "output", label: "Output" },
  { id: "debug", label: "Debug Console" },
  { id: "serial", label: "Serial" },
  { id: "terminal", label: "Terminal" },
] as const;
