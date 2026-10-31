import type { ReactNode } from "react";
import { Eye, EyeOff, GripVertical } from "lucide-react";
import { cn } from "@/utils/cn";

interface PanelChromeProps {
  title: string;
  visible?: boolean;
  onToggleVisible?: () => void;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function PanelChrome({
  title,
  visible = true,
  onToggleVisible,
  actions,
  children,
  className,
  bodyClassName,
}: PanelChromeProps) {
  return (
    <section
      className={cn(
        "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-ags-border bg-ags-panel",
        className,
      )}
    >
      <header className="flex h-8 shrink-0 items-center gap-2 border-b border-ags-border-subtle bg-ags-elevated px-2">
        <GripVertical size={14} className="text-ags-dim" aria-hidden />
        <h3 className="flex-1 truncate text-xs font-semibold uppercase tracking-wide text-ags-muted">
          {title}
        </h3>
        {actions}
        {onToggleVisible && (
          <button
            type="button"
            title={visible ? "Скрыть панель" : "Показать панель"}
            onClick={onToggleVisible}
            className="rounded p-1 text-ags-dim hover:bg-ags-surface hover:text-ags-fg"
          >
            {visible ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
        )}
      </header>
      {visible && (
        <div className={cn("min-h-0 flex-1 overflow-auto", bodyClassName)}>
          {children}
        </div>
      )}
    </section>
  );
}
