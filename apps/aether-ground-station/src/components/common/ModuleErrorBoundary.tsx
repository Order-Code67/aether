import { Component, type ErrorInfo, type ReactNode } from "react";
import { eventBus } from "@/services/events/eventBus";

interface Props {
  name: string;
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Isolates module crashes so video/map failures do not take down the whole shell.
 */
export class ModuleErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    eventBus.emit("error", "module-boundary", `${this.props.name}: ${error.message}`, {
      componentStack: info.componentStack?.slice(0, 500),
    });
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="flex h-full flex-col items-start justify-center gap-3 p-6 text-sm">
            <p className="text-ags-danger">
              Модуль «{this.props.name}» остановился из‑за ошибки.
            </p>
            <p className="max-w-lg font-mono text-xs text-ags-muted">
              {this.state.error.message}
            </p>
            <button
              type="button"
              className="rounded bg-ags-accent px-3 py-1.5 text-white"
              onClick={() => this.setState({ error: null })}
            >
              Перезапустить модуль
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
