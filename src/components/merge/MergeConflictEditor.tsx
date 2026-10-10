import { useMemo } from "react";
import {
  ArrowLeftRight,
  Check,
  ChevronsDownUp,
  GitMerge,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  conflictCount,
  parseConflicts,
  resolveAllConflicts,
  resolveConflict,
  type ConflictChoice,
  type ConflictRegion,
} from "@/lib/mergeConflict";
import { writeEditorContent } from "@/lib/applyEdit";
import { useEditorStore } from "@/stores/editorStore";
import { useScmStore } from "@/stores/scmStore";

function ConflictCard({
  region,
  index,
  total,
  onResolve,
}: {
  region: ConflictRegion;
  index: number;
  total: number;
  onResolve: (id: string, choice: ConflictChoice) => void;
}) {
  return (
    <div className="mb-3 overflow-hidden rounded border border-aether-border">
      <div className="flex items-center justify-between gap-2 border-b border-aether-border bg-aether-activity px-2 py-1.5">
        <span className="text-[11px] font-medium text-aether-fg">
          Conflict {index + 1} of {total}
        </span>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => onResolve(region.id, "ours")}
            className="rounded border border-aether-border px-1.5 py-0.5 text-[10px] text-aether-fg hover:bg-aether-surface-raised"
            title={`Accept ${region.oursLabel}`}
          >
            Accept Current
          </button>
          <button
            type="button"
            onClick={() => onResolve(region.id, "theirs")}
            className="rounded border border-aether-border px-1.5 py-0.5 text-[10px] text-aether-fg hover:bg-aether-surface-raised"
            title={`Accept ${region.theirsLabel}`}
          >
            Accept Incoming
          </button>
          <button
            type="button"
            onClick={() => onResolve(region.id, "both")}
            className="rounded border border-aether-border px-1.5 py-0.5 text-[10px] text-aether-fg hover:bg-aether-surface-raised"
          >
            Accept Both
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className="border-b border-aether-border md:border-b-0 md:border-r">
          <div className="bg-aether-accent-muted/40 px-2 py-1 text-[10px] uppercase tracking-wide text-aether-fg-muted">
            Current · {region.oursLabel}
          </div>
          <pre className="aether-scroll max-h-48 overflow-auto px-2 py-1.5 font-mono text-[11px] leading-4 whitespace-pre-wrap text-aether-fg">
            {region.ours || "(empty)"}
          </pre>
        </div>
        <div>
          <div className="bg-aether-warning/10 px-2 py-1 text-[10px] uppercase tracking-wide text-aether-fg-muted">
            Incoming · {region.theirsLabel}
          </div>
          <pre className="aether-scroll max-h-48 overflow-auto px-2 py-1.5 font-mono text-[11px] leading-4 whitespace-pre-wrap text-aether-fg">
            {region.theirs || "(empty)"}
          </pre>
        </div>
      </div>
    </div>
  );
}

export function MergeConflictEditor() {
  const activeTab = useEditorStore((s) => {
    const id = s.activeTabId;
    return s.tabs.find((t) => t.id === id) ?? null;
  });
  const updateContent = useEditorStore((s) => s.updateContent);
  const refreshScm = useScmStore((s) => s.refresh);

  const regions = useMemo(
    () => (activeTab ? parseConflicts(activeTab.content) : []),
    [activeTab?.content, activeTab?.id],
  );

  if (!activeTab || regions.length === 0) {
    return null;
  }

  const applyContent = async (next: string) => {
    updateContent(activeTab.id, next);
    // Persist when no markers left so git can stage a resolved file easily
    if (!conflictCount(next)) {
      try {
        await writeEditorContent(activeTab.path, next);
        await refreshScm();
      } catch {
        // Editor still has the resolved buffer even if disk write fails
      }
    }
  };

  const onResolve = (id: string, choice: ConflictChoice) => {
    try {
      const next = resolveConflict(activeTab.content, id, choice);
      void applyContent(next);
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Failed to resolve conflict.",
      );
    }
  };

  const onResolveAll = (choice: ConflictChoice) => {
    try {
      const next = resolveAllConflicts(activeTab.content, choice);
      void applyContent(next);
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Failed to resolve conflicts.",
      );
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-aether-border">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-aether-border bg-aether-surface px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 text-xs text-aether-fg">
          <GitMerge size={14} className="shrink-0 text-aether-warning" />
          <span className="truncate font-medium">
            Merge conflicts · {regions.length}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => onResolveAll("ours")}
            className="flex h-7 items-center gap-1 rounded border border-aether-border px-2 text-[11px] text-aether-fg hover:bg-aether-surface-raised"
          >
            <Check size={12} />
            All Current
          </button>
          <button
            type="button"
            onClick={() => onResolveAll("theirs")}
            className="flex h-7 items-center gap-1 rounded border border-aether-border px-2 text-[11px] text-aether-fg hover:bg-aether-surface-raised"
          >
            <ArrowLeftRight size={12} />
            All Incoming
          </button>
          <button
            type="button"
            onClick={() => onResolveAll("both")}
            className="flex h-7 items-center gap-1 rounded border border-aether-border px-2 text-[11px] text-aether-fg hover:bg-aether-surface-raised"
          >
            <ChevronsDownUp size={12} />
            All Both
          </button>
        </div>
      </div>

      <div className="aether-scroll min-h-0 flex-1 overflow-auto px-3 py-3">
        <p className="mb-3 text-[11px] leading-relaxed text-aether-fg-dim">
          Choose Current (ours), Incoming (theirs), or Both for each conflict.
          When none remain, the file is saved so you can stage it.
        </p>
        {regions.map((region: ConflictRegion, index) => (
          <ConflictCard
            key={region.id}
            region={region}
            index={index}
            total={regions.length}
            onResolve={onResolve}
          />
        ))}
      </div>
    </div>
  );
}

/** Compact banner when the editor still shows the raw file with markers. */
export function MergeConflictBanner({
  count,
  active,
  onToggle,
}: {
  count: number;
  active: boolean;
  onToggle: () => void;
}) {
  if (count <= 0) return null;
  return (
    <div
      className={cn(
        "flex h-8 shrink-0 items-center justify-between gap-2 border-b border-aether-border px-3 text-[11px]",
        "bg-aether-warning/15 text-aether-fg",
      )}
    >
      <span className="flex items-center gap-1.5 truncate">
        <GitMerge size={13} className="text-aether-warning" />
        {count} merge conflict{count === 1 ? "" : "s"}
      </span>
      <button
        type="button"
        onClick={onToggle}
        className="shrink-0 rounded border border-aether-border px-2 py-0.5 hover:bg-aether-surface-raised"
      >
        {active ? "Show editor" : "Resolve…"}
      </button>
    </div>
  );
}
