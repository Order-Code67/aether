export type EventSeverity = "debug" | "info" | "warning" | "error";

export interface AppEvent {
  id: string;
  at: string;
  severity: EventSeverity;
  source: string;
  message: string;
  details?: Record<string, unknown>;
}
