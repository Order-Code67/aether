import { useEffect } from "react";
import { AppShell } from "@/components/layout";
import { useAppBootstrap } from "@/hooks/useAppBootstrap";
import { eventBus } from "@/services/events/eventBus";
import { dbAppendEvent, dbInit } from "@/services/database";
import { useEventLogStore } from "@/stores/eventLogStore";

export default function App() {
  useAppBootstrap();
  const append = useEventLogStore((s) => s.append);

  useEffect(() => {
    return eventBus.subscribe((event) => {
      append(event);
      void dbAppendEvent({
        id: event.id,
        at: event.at,
        severity: event.severity,
        source: event.source,
        message: event.message,
      });
    });
  }, [append]);

  useEffect(() => {
    void dbInit().then((path) => {
      eventBus.emit(
        "info",
        "app",
        path
          ? `Интерфейс загружен · SQLite: ${path}`
          : "Интерфейс загружен (без SQLite в браузере)",
      );
    });
  }, []);

  return <AppShell />;
}
