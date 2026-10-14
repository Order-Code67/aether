import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

type Side = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
  side?: Side;
  /** Delay before show (ms). Default 100 — faster than native `title`. */
  delayMs?: number;
  className?: string;
  disabled?: boolean;
}

/**
 * Lightweight hover/focus tooltip. Prefer this over native `title=` for
 * chrome controls — native tooltips are slow and easy to miss.
 */
export function Tooltip({
  content,
  children,
  side = "bottom",
  delayMs = 100,
  className,
  disabled,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tipId = useId();

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const show = useCallback(() => {
    if (disabled || content == null || content === "") return;
    clear();
    timer.current = setTimeout(() => setOpen(true), delayMs);
  }, [clear, content, delayMs, disabled]);

  const hide = useCallback(() => {
    clear();
    setOpen(false);
  }, [clear]);

  useEffect(() => () => clear(), [clear]);

  if (!isValidElement(children)) return children;

  const child = children as ReactElement<Record<string, unknown>>;
  const childProps = child.props;

  const merged = cloneElement(child, {
    "aria-describedby": open
      ? tipId
      : (childProps["aria-describedby"] as string | undefined),
    onMouseEnter: (e: MouseEvent) => {
      (childProps.onMouseEnter as ((ev: MouseEvent) => void) | undefined)?.(e);
      show();
    },
    onMouseLeave: (e: MouseEvent) => {
      (childProps.onMouseLeave as ((ev: MouseEvent) => void) | undefined)?.(e);
      hide();
    },
    onFocus: (e: FocusEvent) => {
      (childProps.onFocus as ((ev: FocusEvent) => void) | undefined)?.(e);
      show();
    },
    onBlur: (e: FocusEvent) => {
      (childProps.onBlur as ((ev: FocusEvent) => void) | undefined)?.(e);
      hide();
    },
  });

  const sideClass =
    side === "right"
      ? "left-full top-1/2 ml-2 -translate-y-1/2"
      : side === "left"
        ? "right-full top-1/2 mr-2 -translate-y-1/2"
        : side === "top"
          ? "bottom-full left-1/2 mb-2 -translate-x-1/2"
          : "top-full left-1/2 mt-2 -translate-x-1/2";

  return (
    <span className={cn("relative inline-flex", className)}>
      {merged}
      {open && content != null && content !== "" ? (
        <span
          id={tipId}
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-[80] max-w-[240px] rounded border border-aether-border bg-aether-surface-raised px-2 py-1 text-left text-[11px] leading-snug text-aether-fg shadow-md",
            sideClass,
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
