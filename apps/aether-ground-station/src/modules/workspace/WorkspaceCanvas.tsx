import { useWorkspaceStore } from "@/stores/workspaceStore";
import { PanelChrome } from "@/components/common/PanelChrome";
import { PanelHost } from "@/components/panels/PanelHost";

export function WorkspaceCanvas() {
  const layout = useWorkspaceStore((s) => s.active());
  const togglePanel = useWorkspaceStore((s) => s.togglePanel);
  const setPanelWeight = useWorkspaceStore((s) => s.setPanelWeight);

  return (
    <div className="flex h-full min-h-0 gap-2 p-2">
      {layout.columns.map((column, colIdx) => {
        const visiblePanels = column
          .map((id) => layout.panels[id])
          .filter((p): p is NonNullable<typeof p> => Boolean(p && p.visible));

        if (visiblePanels.length === 0) return null;

        return (
          <div
            key={`col-${colIdx}`}
            className="flex min-w-0 flex-1 flex-col gap-2"
            style={{
              flexGrow: visiblePanels.reduce((s, p) => s + p.weight, 0),
            }}
          >
            {visiblePanels.map((panel) => (
              <div
                key={panel.id}
                className="min-h-0"
                style={{ flexGrow: panel.weight, flexBasis: 0 }}
              >
                <PanelChrome
                  title={panel.title}
                  visible={panel.visible}
                  onToggleVisible={() => togglePanel(panel.id)}
                  className="h-full"
                  actions={
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Уменьшить"
                        className="px-1 text-[11px] text-ags-dim hover:text-ags-fg"
                        onClick={() =>
                          setPanelWeight(panel.id, panel.weight - 0.25)
                        }
                      >
                        −
                      </button>
                      <button
                        type="button"
                        title="Увеличить"
                        className="px-1 text-[11px] text-ags-dim hover:text-ags-fg"
                        onClick={() =>
                          setPanelWeight(panel.id, panel.weight + 0.25)
                        }
                      >
                        +
                      </button>
                    </div>
                  }
                >
                  <PanelHost kind={panel.kind} />
                </PanelChrome>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
