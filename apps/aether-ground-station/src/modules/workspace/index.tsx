import { WorkspaceCanvas } from "./WorkspaceCanvas";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { PANEL_KIND_LABELS } from "@/types";
import { templateLabel } from "./templates";

export function WorkspaceView() {
  const layouts = useWorkspaceStore((s) => s.layouts);
  const activeLayoutId = useWorkspaceStore((s) => s.activeLayoutId);
  const layout = useWorkspaceStore((s) => s.active());
  const setActiveLayout = useWorkspaceStore((s) => s.setActiveLayout);
  const togglePanel = useWorkspaceStore((s) => s.togglePanel);
  const duplicateActive = useWorkspaceStore((s) => s.duplicateActive);
  const applyTemplate = useWorkspaceStore((s) => s.applyTemplate);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b border-ags-border-subtle px-2 py-1.5">
        {layouts.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setActiveLayout(l.id)}
            className={
              l.id === activeLayoutId
                ? "rounded-t border border-b-0 border-ags-accent/50 bg-ags-elevated px-3 py-1 text-xs text-ags-accent"
                : "rounded-t border border-transparent px-3 py-1 text-xs text-ags-dim hover:text-ags-fg"
            }
          >
            {l.name}
          </button>
        ))}
        <button
          type="button"
          className="ml-1 rounded border border-ags-border px-2 py-0.5 text-xs text-ags-muted"
          onClick={() => applyTemplate("custom")}
          title="Новая вкладка"
        >
          +
        </button>
        <button
          type="button"
          className="rounded border border-ags-border px-2 py-0.5 text-xs text-ags-muted"
          onClick={() => duplicateActive()}
        >
          Дублировать
        </button>
      </div>
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
            title={p.visible ? "unpin" : "pin"}
            className={
              p.visible
                ? "rounded border border-ags-accent/40 bg-ags-elevated px-2 py-0.5 text-ags-accent"
                : "rounded border border-ags-border px-2 py-0.5 text-ags-dim"
            }
          >
            {PANEL_KIND_LABELS[p.kind]}
            <span className="ml-1 opacity-60">
              {p.visible ? "pin" : "off"}
            </span>
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
