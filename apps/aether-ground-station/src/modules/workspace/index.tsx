import { WorkspaceCanvas } from "./WorkspaceCanvas";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { PANEL_KIND_LABELS } from "@/types";
import { templateLabel } from "./templates";

export function WorkspaceView() {
  const layout = useWorkspaceStore((s) => s.active());
  const togglePanel = useWorkspaceStore((s) => s.togglePanel);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-ags-border-subtle px-4 py-2 text-xs text-ags-muted">
        <span className="font-semibold text-ags-fg">{layout.name}</span>
        <span>·</span>
        <span>Шаблон: {templateLabel(layout.template)}</span>
        <span className="mx-2 h-4 w-px bg-ags-border" />
        {Object.values(layout.panels).map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => togglePanel(p.id)}
            className={
              p.visible
                ? "rounded border border-ags-accent/40 bg-ags-elevated px-2 py-0.5 text-ags-accent"
                : "rounded border border-ags-border px-2 py-0.5 text-ags-dim"
            }
          >
            {PANEL_KIND_LABELS[p.kind]}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        <WorkspaceCanvas />
      </div>
    </div>
  );
}

export { WorkspaceCanvas } from "./WorkspaceCanvas";
export { createTemplateLayout, WORKSPACE_TEMPLATES, templateLabel } from "./templates";
