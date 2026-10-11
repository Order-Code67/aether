import { useEffect, useState } from "react";
import { DebugToolbar } from "@/components/debug/DebugToolbar";
import { EditorEncryptBar } from "@/components/editor/EditorEncryptBar";
import { EditorTabs, MonacoEditor, WelcomeView } from "@/components/editor";
import {
  MergeConflictBanner,
  MergeConflictEditor,
} from "@/components/merge/MergeConflictEditor";
import { BuildToolbar } from "@/components/platformio/BuildToolbar";
import { ComDriversHelp } from "@/components/serial/ComDriversHelp";
import { conflictCount, hasConflictMarkers } from "@/lib/mergeConflict";
import { useEditorStore } from "@/stores/editorStore";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useSerialStore } from "@/stores/serialStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function EditorArea() {
  const hasTabs = useEditorStore((s) => s.tabs.length > 0);
  const activeTab = useEditorStore((s) => {
    const id = s.activeTabId;
    return s.tabs.find((t) => t.id === id) ?? null;
  });
  const isProject = usePlatformIoStore((s) => s.isProject);
  const pioError = usePlatformIoStore((s) => s.error);
  const ports = useSerialStore((s) => s.ports);
  const kind = useWorkspaceStore((s) => s.kind);
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
      {kind === "folder" && isProject && (ports.length === 0 || pioError) && (
        <ComDriversHelp
          compact
          portsEmpty={ports.length === 0}
          error={pioError}
        />
      )}
      <DebugToolbar />
      {hasTabs && <EditorEncryptBar />}
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
