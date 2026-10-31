import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useProfileStore } from "@/stores/profileStore";
import { templateLabel, WORKSPACE_TEMPLATES } from "@/modules/workspace/templates";
import type { WorkspaceTemplateId } from "@/types";

export function TopBar() {
  const layouts = useWorkspaceStore((s) => s.layouts);
  const activeLayoutId = useWorkspaceStore((s) => s.activeLayoutId);
  const setActiveLayout = useWorkspaceStore((s) => s.setActiveLayout);
  const applyTemplate = useWorkspaceStore((s) => s.applyTemplate);
  const duplicateActive = useWorkspaceStore((s) => s.duplicateActive);
  const setEventLogVisible = useWorkspaceStore((s) => s.setEventLogVisible);
  const setDeviceRailVisible = useWorkspaceStore((s) => s.setDeviceRailVisible);
  const active = useWorkspaceStore((s) => s.active());

  const profiles = useProfileStore((s) => s.profiles);
  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const setActiveProfile = useProfileStore((s) => s.setActive);
  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-ags-border-subtle bg-ags-surface px-3">
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-[0.18em] text-ags-dim">
          Aether Ground Station
        </div>
        <div className="truncate text-sm font-semibold text-ags-fg">
          {activeProfile?.name ?? "Комплекс не выбран"}
        </div>
      </div>

      <div className="mx-2 h-6 w-px bg-ags-border" />

      <label className="flex items-center gap-2 text-xs text-ags-muted">
        Профиль
        <select
          className="max-w-[12rem] rounded border border-ags-border bg-ags-elevated px-2 py-1 text-ags-fg"
          value={activeProfileId ?? ""}
          onChange={(e) => setActiveProfile(e.target.value || null)}
        >
          <option value="">— нет —</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-xs text-ags-muted">
        Workspace
        <select
          className="max-w-[12rem] rounded border border-ags-border bg-ags-elevated px-2 py-1 text-ags-fg"
          value={activeLayoutId}
          onChange={(e) => setActiveLayout(e.target.value)}
        >
          {layouts.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-xs text-ags-muted">
        Шаблон
        <select
          className="rounded border border-ags-border bg-ags-elevated px-2 py-1 text-ags-fg"
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value as WorkspaceTemplateId;
            if (v) applyTemplate(v);
            e.target.value = "";
          }}
        >
          <option value="" disabled>
            Создать из…
          </option>
          {WORKSPACE_TEMPLATES.map((t) => (
            <option key={t} value={t}>
              {templateLabel(t)}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        onClick={duplicateActive}
        className="rounded border border-ags-border px-2 py-1 text-xs text-ags-muted hover:bg-ags-elevated hover:text-ags-fg"
      >
        Копировать layout
      </button>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => setDeviceRailVisible(!active.deviceRailVisible)}
          className="rounded border border-ags-border px-2 py-1 text-xs text-ags-muted hover:bg-ags-elevated hover:text-ags-fg"
        >
          {active.deviceRailVisible ? "Скрыть оборудование" : "Показать оборудование"}
        </button>
        <button
          type="button"
          onClick={() => setEventLogVisible(!active.eventLogVisible)}
          className="rounded border border-ags-border px-2 py-1 text-xs text-ags-muted hover:bg-ags-elevated hover:text-ags-fg"
        >
          {active.eventLogVisible ? "Скрыть журнал" : "Показать журнал"}
        </button>
      </div>
    </header>
  );
}
