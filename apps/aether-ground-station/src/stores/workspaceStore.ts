import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WorkspaceLayout, WorkspaceTemplateId } from "@/types";
import { createTemplateLayout } from "@/modules/workspace/templates";

interface WorkspaceState {
  layouts: WorkspaceLayout[];
  activeLayoutId: string;
  active: () => WorkspaceLayout;
  applyTemplate: (template: WorkspaceTemplateId) => void;
  setActiveLayout: (id: string) => void;
  renameActive: (name: string) => void;
  togglePanel: (panelId: string) => void;
  setPanelWeight: (panelId: string, weight: number) => void;
  movePanel: (panelId: string, columnIndex: number, rowIndex: number) => void;
  setEventLogVisible: (visible: boolean) => void;
  setEventLogHeight: (height: number) => void;
  setDeviceRailVisible: (visible: boolean) => void;
  setDeviceRailWidth: (width: number) => void;
  duplicateActive: () => void;
}

function touch(layout: WorkspaceLayout): WorkspaceLayout {
  return { ...layout, updatedAt: new Date().toISOString() };
}

const initial = createTemplateLayout("standard", "Стандартный");

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      layouts: [initial],
      activeLayoutId: initial.id,

      active: () => {
        const state = get();
        return (
          state.layouts.find((l) => l.id === state.activeLayoutId) ??
          state.layouts[0]!
        );
      },

      applyTemplate: (template) => {
        const layout = createTemplateLayout(template);
        set((s) => ({
          layouts: [...s.layouts, layout],
          activeLayoutId: layout.id,
        }));
      },

      setActiveLayout: (id) => set({ activeLayoutId: id }),

      renameActive: (name) =>
        set((s) => ({
          layouts: s.layouts.map((l) =>
            l.id === s.activeLayoutId ? touch({ ...l, name }) : l,
          ),
        })),

      togglePanel: (panelId) =>
        set((s) => ({
          layouts: s.layouts.map((l) => {
            if (l.id !== s.activeLayoutId) return l;
            const panel = l.panels[panelId];
            if (!panel) return l;
            return touch({
              ...l,
              panels: {
                ...l.panels,
                [panelId]: { ...panel, visible: !panel.visible },
              },
            });
          }),
        })),

      setPanelWeight: (panelId, weight) =>
        set((s) => ({
          layouts: s.layouts.map((l) => {
            if (l.id !== s.activeLayoutId) return l;
            const panel = l.panels[panelId];
            if (!panel) return l;
            return touch({
              ...l,
              panels: {
                ...l.panels,
                [panelId]: { ...panel, weight: Math.max(0.4, weight) },
              },
            });
          }),
        })),

      movePanel: (panelId, columnIndex, rowIndex) =>
        set((s) => ({
          layouts: s.layouts.map((l) => {
            if (l.id !== s.activeLayoutId) return l;
            const columns = l.columns.map((col) =>
              col.filter((id) => id !== panelId),
            );
            while (columns.length <= columnIndex) columns.push([]);
            const col = [...(columns[columnIndex] ?? [])];
            col.splice(Math.max(0, rowIndex), 0, panelId);
            columns[columnIndex] = col;
            return touch({
              ...l,
              columns: columns.filter((c) => c.length > 0),
            });
          }),
        })),

      setEventLogVisible: (eventLogVisible) =>
        set((s) => ({
          layouts: s.layouts.map((l) =>
            l.id === s.activeLayoutId ? touch({ ...l, eventLogVisible }) : l,
          ),
        })),

      setEventLogHeight: (eventLogHeight) =>
        set((s) => ({
          layouts: s.layouts.map((l) =>
            l.id === s.activeLayoutId
              ? touch({
                  ...l,
                  eventLogHeight: Math.min(360, Math.max(80, eventLogHeight)),
                })
              : l,
          ),
        })),

      setDeviceRailVisible: (deviceRailVisible) =>
        set((s) => ({
          layouts: s.layouts.map((l) =>
            l.id === s.activeLayoutId ? touch({ ...l, deviceRailVisible }) : l,
          ),
        })),

      setDeviceRailWidth: (deviceRailWidth) =>
        set((s) => ({
          layouts: s.layouts.map((l) =>
            l.id === s.activeLayoutId
              ? touch({
                  ...l,
                  deviceRailWidth: Math.min(420, Math.max(200, deviceRailWidth)),
                })
              : l,
          ),
        })),

      duplicateActive: () => {
        const current = get().active();
        const copy: WorkspaceLayout = {
          ...structuredClone(current),
          id: `ws_copy_${Date.now().toString(36)}`,
          name: `${current.name} (копия)`,
          template: "custom",
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({
          layouts: [...s.layouts, copy],
          activeLayoutId: copy.id,
        }));
      },
    }),
    { name: "ags-workspace-v1" },
  ),
);
