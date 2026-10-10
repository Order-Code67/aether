import { useEffect, useState } from "react";
import { DebugToolbar } from "@/components/debug/DebugToolbar";
import { EditorTabs, MonacoEditor, WelcomeView } from "@/components/editor";
import {
  MergeConflictBanner,
  MergeConflictEditor,
} from "@/components/merge/MergeConflictEditor";
import { BuildToolbar } from "@/components/platformio/BuildToolbar";
import { conflictCount, hasConflictMarkers } from "@/lib/mergeConflict";
import { useEditorStore } from "@/stores/editorStore";

export function EditorArea() {
  const hasTabs = useEditorStore((s) => s.tabs.length > 0);
  const activeTab = useEditorStore((s) => {
    const id = s.activeTabId;
    return s.tabs.find((t) => t.id === id) ?? null;
  });
  const [showResolver, setShowResolver] = useState(true);

  const conflicts = activeTab ? conflictCount(activeTab.content) : 0;
  const conflicted = activeTab
    ? hasConflictMarkers(activeTab.content)
    : false;

  // When switching to a newly conflicted file, open the resolver by default.
  useEffect(() => {
    if (conflicted && conflicts > 0) {
      setShowResolver(true);
    }
  }, [activeTab?.path, conflicted, conflicts]);

  return (
    <section
      className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-aether-bg"
      aria-label="Editor"
    >
      <EditorTabs />
      <BuildToolbar />
      <DebugToolbar />
      {hasTabs && conflicted && (
        <MergeConflictBanner
          count={conflicts}
          active={showResolver && conflicts > 0}
          onToggle={() => setShowResolver((v) => !v)}
        />
      )}
      {!hasTabs ? (
        <WelcomeView />
      ) : conflicted && showResolver && conflicts > 0 ? (
        <MergeConflictEditor />
      ) : (
        <MonacoEditor />
      )}
    </section>
  );
}
