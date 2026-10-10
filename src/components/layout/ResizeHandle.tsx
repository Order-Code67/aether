import { useRef, useState } from "react";
import { cn } from "@/lib/cn";

type Orientation = "vertical" | "horizontal";

interface ResizeHandleProps {
  orientation: Orientation;
  /**
   * Called with a delta in CSS pixels.
   * - vertical: positive = grow toward the right
   * - horizontal: positive = grow upward (bottom panel taller)
   */
  onDrag: (delta: number) => void;
  onDoubleClick?: () => void;
  label: string;
}

export function ResizeHandle({
  orientation,
  onDrag,
  onDoubleClick,
  label,
}: ResizeHandleProps) {
  const lastPos = useRef<number | null>(null);
  const [active, setActive] = useState(false);
  const isVertical = orientation === "vertical";

  return (
    <div
      role="separator"
      aria-orientation={isVertical ? "vertical" : "horizontal"}
      aria-label={label}
      title={`${label} (double-click to reset)`}
      onDoubleClick={onDoubleClick}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        lastPos.current = isVertical ? event.clientX : event.clientY;
        setActive(true);
        document.body.classList.add("aether-resizing");
        document.body.style.cursor = isVertical ? "col-resize" : "row-resize";
        document.body.style.userSelect = "none";
      }}
      onPointerMove={(event) => {
        if (lastPos.current === null) return;
        const current = isVertical ? event.clientX : event.clientY;
        const rawDelta = current - lastPos.current;
        lastPos.current = current;
        const delta = isVertical ? rawDelta : -rawDelta;
        if (delta !== 0) onDrag(delta);
      }}
      onPointerUp={(event) => {
        if (lastPos.current === null) return;
        event.currentTarget.releasePointerCapture(event.pointerId);
        lastPos.current = null;
        setActive(false);
        document.body.classList.remove("aether-resizing");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }}
      onPointerCancel={(event) => {
        lastPos.current = null;
        setActive(false);
        document.body.classList.remove("aether-resizing");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          // ignore
        }
      }}
      className={cn(
        "group relative z-20 shrink-0 touch-none",
        isVertical
          ? "w-1 cursor-col-resize hover:bg-aether-accent/40"
          : "h-1 cursor-row-resize hover:bg-aether-accent/40",
        active && "bg-aether-accent/60",
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute bg-transparent transition-colors group-hover:bg-aether-accent/50",
          isVertical
            ? "inset-y-0 left-1/2 w-px -translate-x-1/2"
            : "inset-x-0 top-1/2 h-px -translate-y-1/2",
          active && "bg-aether-accent",
        )}
      />
    </div>
  );
}
