import { Save, SaveAll, X } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import { isMainSketchPath } from "@/lib/sketchMode";
import { useEditorStore } from "@/stores/editorStore";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function EditorTabs() {
  const { t } = useI18n();
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const closeTab = useEditorStore((s) => s.closeTab);
  const saveTab = useEditorStore((s) => s.saveTab);
  const saveAllTabs = useEditorStore((s) => s.saveAllTabs);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const isProject = usePlatformIoStore((s) => s.isProject);
  const sketchMode = useSettingsStore((s) => s.sketchMode);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;
  const dirtyCount = tabs.filter((tab) => tab.dirty).length;
  const saving = saveStatus.kind === "saving";

  if (tabs.length === 0) {
    return (
      <div className="flex h-9 shrink-0 items-center border-b border-aether-border bg-aether-surface px-3">
        <span className="text-xs text-aether-fg-muted">Editor</span>
      </div>
    );
  }

  return (
    <div className="flex h-9 shrink-0 items-stretch border-b border-aether-border bg-aether-surface">
      <div
        className="flex min-w-0 flex-1 items-stretch overflow-x-auto"
        role="tablist"
        aria-label="Open editors"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const showSketchBadge =
            sketchMode &&
            isProject &&
            !!rootPath &&
            isMainSketchPath(tab.path, rootPath);
          return (
            <div
              key={tab.id}
              className={cn(
                "group flex max-w-[220px] min-w-[120px] items-center gap-1 border-r border-aether-border px-2",
                isActive
                  ? "bg-aether-bg text-aether-fg"
                  : "bg-aether-surface text-aether-fg-muted hover:bg-aether-surface-raised",
              )}
            >
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                title={tab.path}
                onClick={() => setActiveTab(tab.id)}
                className="flex min-w-0 flex-1 items-center gap-1 py-1 text-left text-xs"
              >
                <span className="truncate">
                  {tab.dirty ? "● " : ""}
                  {tab.name}
                </span>
                {showSketchBadge && (
                  <span className="shrink-0 rounded bg-aether-accent-muted px-1 py-px text-[9px] font-medium uppercase tracking-wide text-aether-fg-muted">
                    {t("sketch.badge")}
                  </span>
                )}
              </button>
              <button
                type="button"
                title={`Close ${tab.name}`}
                aria-label={`Close ${tab.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  closeTab(tab.id);
                }}
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded text-aether-fg-dim transition-colors",
                  "hover:bg-aether-border-subtle hover:text-aether-fg",
                  !isActive && "opacity-0 group-hover:opacity-100",
                )}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 border-l border-aether-border px-1.5">
        <button
          type="button"
          title="Save (Ctrl+S)"
          aria-label="Save"
          disabled={!activeTab?.dirty || saving}
          onClick={() => {
            void saveTab();
          }}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded text-aether-fg-muted transition-colors",
            "hover:bg-aether-surface-raised hover:text-aether-fg",
            "disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-aether-fg-muted",
          )}
        >
          <Save size={14} />
        </button>
        <button
          type="button"
          title="Save All (Ctrl+Shift+S)"
          aria-label="Save All"
          disabled={dirtyCount === 0 || saving}
          onClick={() => {
            void saveAllTabs();
          }}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded text-aether-fg-muted transition-colors",
            "hover:bg-aether-surface-raised hover:text-aether-fg",
            "disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-aether-fg-muted",
          )}
        >
          <SaveAll size={14} />
        </button>
      </div>
    </div>
  );
}
