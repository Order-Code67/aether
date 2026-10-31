import type { AppEvent, EventSeverity } from "@/types";
import { redactSecrets } from "@/utils/redact";

type Listener = (event: AppEvent) => void;

function createId(): string {
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

class EventBus {
  private readonly listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(
    severity: EventSeverity,
    source: string,
    message: string,
    details?: Record<string, unknown>,
  ): AppEvent {
    const event: AppEvent = {
      id: createId(),
      at: new Date().toISOString(),
      severity,
      source,
      message,
      details: details ? redactSecrets(details) : undefined,
    };
    for (const listener of this.listeners) listener(event);
    return event;
  }
}

export const eventBus = new EventBus();
