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
import { UnlockGate } from "@/components/editor/UnlockGate";
import { NewProjectDialog } from "@/components/explorer/NewProjectDialog";
import { OpenExamplesDialog } from "@/components/explorer/OpenExamplesDialog";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { CommandPalette } from "@/components/palette/CommandPalette";
import { ToolsDoctorBanner } from "@/components/platformio/ToolsDoctorBanner";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { UpdateDialog } from "@/components/updater/UpdateDialog";
import { isTauriRuntime } from "@/lib/tauri";
import { usePaletteStore } from "@/stores/paletteStore";
import { useLayoutStore } from "@/stores/layoutStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useOfflineStore } from "@/stores/offlineStore";
import { useUpdaterStore } from "@/stores/updaterStore";
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
  const openExampleSignal = usePaletteStore((s) => s.openExampleSignal);
  const onboardingSignal = usePaletteStore((s) => s.onboardingSignal);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  useEffect(() => {
    if (newProjectSignal > 0) setNewProjectOpen(true);
  }, [newProjectSignal]);
  useEffect(() => {
    if (openExampleSignal > 0) setExamplesOpen(true);
  }, [openExampleSignal]);
  useEffect(() => {
    if (onboardingSignal > 0) setOnboardingOpen(true);
  }, [onboardingSignal]);

  // First desktop launch: open Quick Start once (respects onboardingDone from 0.2.12+).
  useEffect(() => {
    if (!isTauriRuntime()) return;
    let cancelled = false;
    const maybeOpen = () => {
      if (cancelled) return;
      if (!useSettingsStore.getState().onboardingDone) {
        setOnboardingOpen(true);
      }
    };
    const persistApi = useSettingsStore.persist;
    if (persistApi.hasHydrated()) {
      maybeOpen();
      return () => {
        cancelled = true;
      };
    }
    const unsub = persistApi.onFinishHydration(() => maybeOpen());
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  // Offline detection + quiet update check (skipped when offline).
  useEffect(() => {
    useOfflineStore.getState().init();
    if (!isTauriRuntime()) return;
    const timer = window.setTimeout(() => {
      void useUpdaterStore.getState().quietCheckOnStartup();
    }, 2500);
    return () => window.clearTimeout(timer);
  }, []);

  const sidebarVisible = useLayoutStore((s) => s.sidebarVisible);
  const bottomPanelVisible = useLayoutStore((s) => s.bottomPanelVisible);
  const resizeSidebarBy = useLayoutStore((s) => s.resizeSidebarBy);
  const resetSidebarWidth = useLayoutStore((s) => s.resetSidebarWidth);
  const resizeBottomPanelBy = useLayoutStore((s) => s.resizeBottomPanelBy);
  const resetBottomPanelHeight = useLayoutStore((s) => s.resetBottomPanelHeight);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-aether-bg">
      <ToolsDoctorBanner />
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
      <UpdateDialog />
      <CommandPalette />
      <UnlockGate />
      <NewProjectDialog
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
      />
      <OpenExamplesDialog
        open={examplesOpen}
        onClose={() => setExamplesOpen(false)}
      />
      <OnboardingWizard
        open={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
      />
    </div>
  );
}
