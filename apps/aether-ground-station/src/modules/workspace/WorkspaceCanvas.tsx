import { useState } from "react";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { PanelChrome } from "@/components/common/PanelChrome";
import { PanelHost } from "@/components/panels/PanelHost";

/**
 * Constructor canvas: HTML5 drag-and-drop between columns + resize weights.
 */
export function WorkspaceCanvas() {
  const layout = useWorkspaceStore((s) => s.active());
  const togglePanel = useWorkspaceStore((s) => s.togglePanel);
  const setPanelWeight = useWorkspaceStore((s) => s.setPanelWeight);
  const movePanel = useWorkspaceStore((s) => s.movePanel);
  const [dragId, setDragId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="flex h-full min-h-0 gap-2 p-2">
      <div className="flex min-w-0 flex-1 gap-2">
        {layout.columns.map((column, colIdx) => {
          const visiblePanels = column
            .map((id) => layout.panels[id])
            .filter((p): p is NonNullable<typeof p> => Boolean(p && p.visible));

          return (
            <div
              key={`col-${colIdx}`}
              className="flex min-h-0 min-w-[12rem] flex-1 flex-col gap-2 rounded border border-dashed border-ags-border-subtle p-1"
              style={{
                flexGrow: Math.max(
                  1,
                  visiblePanels.reduce((s, p) => s + p.weight, 0),
                ),
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/panel-id") || dragId;
                if (!id) return;
                movePanel(id, colIdx, visiblePanels.length);
                setDragId(null);
              }}
            >
              {visiblePanels.length === 0 && (
                <div className="flex flex-1 items-center justify-center text-xs text-ags-dim">
                  Перетащите панель сюда
                </div>
              )}
              {visiblePanels.map((panel, rowIdx) => (
                <div
                  key={panel.id}
                  className="min-h-0"
                  style={{ flexGrow: panel.weight, flexBasis: 0 }}
                  draggable
                  onDragStart={(e) => {
                    setDragId(panel.id);
                    e.dataTransfer.setData("text/panel-id", panel.id);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const id = e.dataTransfer.getData("text/panel-id") || dragId;
                    if (!id) return;
                    movePanel(id, colIdx, rowIdx);
                    setDragId(null);
                  }}
                  onClick={() => setSelectedId(panel.id)}
                >
                  <PanelChrome
                    title={panel.title}
                    visible={panel.visible}
                    onToggleVisible={() => togglePanel(panel.id)}
                    className={
                      selectedId === panel.id
                        ? "h-full ring-1 ring-ags-accent"
                        : "h-full"
                    }
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
                        <button
                          type="button"
                          title={panel.visible ? "Скрыть (unpin)" : "Показать"}
                          className="px-1 text-[11px] text-ags-dim hover:text-ags-fg"
                          onClick={() => togglePanel(panel.id)}
                        >
                          {panel.visible ? "unpin" : "pin"}
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

      <aside className="w-56 shrink-0 overflow-auto rounded border border-ags-border bg-ags-panel p-3 text-xs">
        <h3 className="mb-2 font-semibold uppercase tracking-wide text-ags-muted">
          Настройки панели
        </h3>
        {!selectedId || !layout.panels[selectedId] ? (
          <p className="text-ags-dim">Выберите панель кликом.</p>
        ) : (
          <div className="space-y-2 text-ags-fg">
            <div>
              <span className="text-ags-dim">ID</span>
              <div className="font-mono">{selectedId}</div>
            </div>
            <div>
              <span className="text-ags-dim">Тип</span>
              <div>{layout.panels[selectedId].kind}</div>
            </div>
            <div>
              <span className="text-ags-dim">Вес</span>
              <div>{layout.panels[selectedId].weight}</div>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={layout.panels[selectedId].visible}
                onChange={() => togglePanel(selectedId)}
              />
              Видима
            </label>
          </div>
        )}
      </aside>
    </div>
  );
}
