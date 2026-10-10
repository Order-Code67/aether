import { useEffect, useState } from "react";
import { useDebugBridge } from "@/hooks/useDebugBridge";
import { useEditorShortcuts } from "@/hooks/useEditorShortcuts";
import { useLspBridge } from "@/hooks/useLspBridge";
import { useMenuBridge } from "@/hooks/useMenuBridge";
import { usePlatformIoBridge } from "@/hooks/usePlatformIoBridge";
import { useSaveStatusToast } from "@/hooks/useSaveStatusToast";
import { useSerialBridge } from "@/hooks/useSerialBridge";
import { useScmBridge } from "@/hooks/useScmBridge";
import { useWorkspaceWatcher } from "@/hooks/useWorkspaceWatcher";
import { NewProjectDialog } from "@/components/explorer/NewProjectDialog";
import { CommandPalette } from "@/components/palette/CommandPalette";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { usePaletteStore } from "@/stores/paletteStore";
import { useLayoutStore } from "@/stores/layoutStore";
import { ActivityBar } from "./ActivityBar";
import { Sidebar } from "./Sidebar";
import { EditorArea } from "./EditorArea";
import { BottomPanel } from "./BottomPanel";
import { StatusBar } from "./StatusBar";
import { ResizeHandle } from "./ResizeHandle";

export function IdeLayout() {
  useEditorShortcuts();
  useSaveStatusToast();
  useSerialBridge();
  usePlatformIoBridge();
  useWorkspaceWatcher();
  useScmBridge();
  useLspBridge();
  useDebugBridge();
  useMenuBridge();

  const newProjectSignal = usePaletteStore((s) => s.newProjectSignal);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  useEffect(() => {
    if (newProjectSignal > 0) setNewProjectOpen(true);
  }, [newProjectSignal]);

  const sidebarVisible = useLayoutStore((s) => s.sidebarVisible);
  const bottomPanelVisible = useLayoutStore((s) => s.bottomPanelVisible);
  const resizeSidebarBy = useLayoutStore((s) => s.resizeSidebarBy);
  const resetSidebarWidth = useLayoutStore((s) => s.resetSidebarWidth);
  const resizeBottomPanelBy = useLayoutStore((s) => s.resizeBottomPanelBy);
  const resetBottomPanelHeight = useLayoutStore((s) => s.resetBottomPanelHeight);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-aether-bg">
      <div className="flex min-h-0 flex-1">
        <ActivityBar />
        <Sidebar />
        {sidebarVisible && (
          <ResizeHandle
            orientation="vertical"
            label="Resize sidebar"
            onDrag={resizeSidebarBy}
            onDoubleClick={resetSidebarWidth}
          />
        )}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <EditorArea />
          {bottomPanelVisible && (
            <ResizeHandle
              orientation="horizontal"
              label="Resize bottom panel"
              onDrag={resizeBottomPanelBy}
              onDoubleClick={resetBottomPanelHeight}
            />
          )}
          <BottomPanel />
        </div>
      </div>
      <StatusBar />
      <SettingsDialog />
      <CommandPalette />
      <NewProjectDialog
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
      />
    </div>
  );
}
