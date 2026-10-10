import { useDebugStore } from "@/stores/debugStore";
import { useEditorStore } from "@/stores/editorStore";
import { useExtensionStore } from "@/stores/extensionStore";
import { useLayoutStore } from "@/stores/layoutStore";
import { usePaletteStore } from "@/stores/paletteStore";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useScmStore } from "@/stores/scmStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export type CommandCategory =
  | "File"
  | "Edit"
  | "View"
  | "PlatformIO"
  | "Git"
  | "Debug"
  | "Agent"
  | "Extensions"
  | "Settings";

export interface Command {
  id: string;
  title: string;
  category: CommandCategory;
  keywords?: string;
  keybinding?: string;
  run: () => void | Promise<void>;
}

function view(activity: Parameters<
  ReturnType<typeof useLayoutStore.getState>["setActiveActivity"]
>[0]) {
  useLayoutStore.getState().setActiveActivity(activity);
}

function bottom(
  tab: Parameters<
    ReturnType<typeof useLayoutStore.getState>["setBottomPanelTab"]
  >[0],
) {
  useLayoutStore.getState().setBottomPanelTab(tab);
}

/** Central command registry used by Command Palette and native menu bridge. */
export function getCommands(): Command[] {
  return [
    {
      id: "file.openFolder",
      title: "Open Folder…",
      category: "File",
      keywords: "workspace project",
      keybinding: undefined,
      run: () => void useWorkspaceStore.getState().openFolder(),
    },
    {
      id: "file.addFolder",
      title: "Add Folder to Workspace…",
      category: "File",
      run: () => void useWorkspaceStore.getState().addFolder(),
    },
    {
      id: "file.newProject",
      title: "New Project…",
      category: "File",
      keywords: "create pio wizard arduino project новый проект",
      run: () => {
        usePaletteStore.getState().requestNewProject();
      },
    },
    {
      id: "file.openExample",
      title: "Examples…",
      category: "File",
      keywords: "examples sample esp32 mega nano arduino примеры",
      run: () => {
        usePaletteStore.getState().requestOpenExample();
      },
    },
    {
      id: "file.save",
      title: "Save",
      category: "File",
      keybinding: "Ctrl+S",
      run: () => void useEditorStore.getState().saveTab(),
    },
    {
      id: "file.saveAll",
      title: "Save All",
      category: "File",
      keybinding: "Ctrl+Shift+S",
      run: () => void useEditorStore.getState().saveAllTabs(),
    },
    {
      id: "file.closeWorkspace",
      title: "Close Workspace",
      category: "File",
      run: () => useWorkspaceStore.getState().closeWorkspace(),
    },
    {
      id: "file.quickOpen",
      title: "Go to File…",
      category: "File",
      keybinding: "Ctrl+P",
      run: () => usePaletteStore.getState().open("files"),
    },
    {
      id: "edit.find",
      title: "Find in File",
      category: "Edit",
      keybinding: "Ctrl+F",
      run: () => useEditorStore.getState().requestFind("find"),
    },
    {
      id: "edit.replace",
      title: "Replace in File",
      category: "Edit",
      keybinding: "Ctrl+H",
      run: () => useEditorStore.getState().requestFind("replace"),
    },
    {
      id: "view.commandPalette",
      title: "Show Command Palette",
      category: "View",
      keybinding: "Ctrl+Shift+P",
      run: () => usePaletteStore.getState().open("commands"),
    },
    {
      id: "view.explorer",
      title: "Show Explorer",
      category: "View",
      run: () => view("explorer"),
    },
    {
      id: "view.search",
      title: "Show Search",
      category: "View",
      keybinding: "Ctrl+Shift+F",
      run: () => view("search"),
    },
    {
      id: "view.sourceControl",
      title: "Show Source Control",
      category: "View",
      keybinding: "Ctrl+Shift+G",
      run: () => view("source-control"),
    },
    {
      id: "view.boards",
      title: "Show Boards & Targets",
      category: "View",
      run: () => view("boards"),
    },
    {
      id: "view.debug",
      title: "Show Run and Debug",
      category: "View",
      keybinding: "Ctrl+Shift+D",
      run: () => view("debug"),
    },
    {
      id: "view.agent",
      title: "Show AI Agent",
      category: "View",
      run: () => view("agent"),
    },
    {
      id: "view.extensions",
      title: "Show Extensions",
      category: "View",
      keybinding: "Ctrl+Shift+X",
      run: () => view("extensions"),
    },
    {
      id: "view.toggleSidebar",
      title: "Toggle Sidebar",
      category: "View",
      run: () => {
        const s = useLayoutStore.getState();
        s.setSidebarVisible(!s.sidebarVisible);
      },
    },
    {
      id: "view.togglePanel",
      title: "Toggle Bottom Panel",
      category: "View",
      run: () => useLayoutStore.getState().toggleBottomPanel(),
    },
    {
      id: "view.terminal",
      title: "Toggle Terminal",
      category: "View",
      run: () => {
        const s = useLayoutStore.getState();
        if (s.bottomPanelVisible && s.bottomPanelTab === "terminal") {
          s.setBottomPanelVisible(false);
        } else {
          bottom("terminal");
        }
      },
    },
    {
      id: "view.problems",
      title: "Show Problems",
      category: "View",
      run: () => bottom("problems"),
    },
    {
      id: "view.output",
      title: "Show Output",
      category: "View",
      run: () => bottom("output"),
    },
    {
      id: "view.serial",
      title: "Show Serial Monitor",
      category: "View",
      run: () => bottom("serial"),
    },
    {
      id: "view.debugConsole",
      title: "Show Debug Console",
      category: "View",
      run: () => bottom("debug"),
    },
    {
      id: "pio.build",
      title: "PlatformIO: Build",
      category: "PlatformIO",
      keybinding: "Ctrl+Shift+B",
      run: () => void usePlatformIoStore.getState().runTask("build"),
    },
    {
      id: "pio.upload",
      title: "PlatformIO: Upload",
      category: "PlatformIO",
      keybinding: "Ctrl+Alt+U",
      run: () => void usePlatformIoStore.getState().runTask("upload"),
    },
    {
      id: "pio.doctor",
      title: "PlatformIO: Check Tools…",
      category: "PlatformIO",
      keywords: "doctor toolchain clangd python диагностика",
      run: () => {
        usePlatformIoStore.getState().showDoctor();
        void usePlatformIoStore.getState().runDoctor();
      },
    },
    {
      id: "pio.clean",
      title: "PlatformIO: Clean",
      category: "PlatformIO",
      run: () => void usePlatformIoStore.getState().runTask("clean"),
    },
    {
      id: "pio.compiledb",
      title: "PlatformIO: Generate IntelliSense DB",
      category: "PlatformIO",
      keywords: "compiledb clangd",
      run: () => void usePlatformIoStore.getState().runTask("compiledb"),
    },
    {
      id: "git.refresh",
      title: "Git: Refresh Status",
      category: "Git",
      run: () => void useScmStore.getState().refresh(),
    },
    {
      id: "git.fetch",
      title: "Git: Fetch",
      category: "Git",
      run: () => void useScmStore.getState().fetch(),
    },
    {
      id: "git.pull",
      title: "Git: Pull",
      category: "Git",
      run: () => void useScmStore.getState().pull(),
    },
    {
      id: "git.push",
      title: "Git: Push",
      category: "Git",
      run: () => void useScmStore.getState().push(),
    },
    {
      id: "debug.start",
      title: "Debug: Start",
      category: "Debug",
      keybinding: "F5",
      run: () => void useDebugStore.getState().start(),
    },
    {
      id: "debug.stop",
      title: "Debug: Stop",
      category: "Debug",
      keybinding: "Shift+F5",
      run: () => void useDebugStore.getState().stop(),
    },
    {
      id: "debug.continue",
      title: "Debug: Continue",
      category: "Debug",
      keybinding: "F5",
      run: () => void useDebugStore.getState().continueExec(),
    },
    {
      id: "debug.stepOver",
      title: "Debug: Step Over",
      category: "Debug",
      keybinding: "F10",
      run: () => void useDebugStore.getState().stepOver(),
    },
    {
      id: "debug.stepInto",
      title: "Debug: Step Into",
      category: "Debug",
      keybinding: "F11",
      run: () => void useDebugStore.getState().stepInto(),
    },
    {
      id: "debug.stepOut",
      title: "Debug: Step Out",
      category: "Debug",
      keybinding: "Shift+F11",
      run: () => void useDebugStore.getState().stepOut(),
    },
    {
      id: "agent.focus",
      title: "AI Agent: Focus Chat",
      category: "Agent",
      run: () => view("agent"),
    },
    {
      id: "extensions.show",
      title: "Extensions: Show",
      category: "Extensions",
      keybinding: "Ctrl+Shift+X",
      run: () => view("extensions"),
    },
    {
      id: "libraries.show",
      title: "Libraries: Show Manager",
      category: "PlatformIO",
      keywords: "arduino lib pkg install",
      run: () => view("libraries"),
    },
    {
      id: "extensions.publish",
      title: "Extensions: Open Publisher",
      category: "Extensions",
      keywords: "hub catalog author",
      run: () => {
        useExtensionStore.getState().setPreferredPanelTab("publish");
        view("extensions");
      },
    },
    {
      id: "settings.open",
      title: "Preferences: Open Settings",
      category: "Settings",
      keybinding: "Ctrl+,",
      run: () => useSettingsStore.getState().openSettings(),
    },
    {
      id: "settings.about",
      title: "Help: About Aether",
      category: "Settings",
      run: () => useSettingsStore.getState().openSettings("about"),
    },
    {
      id: "help.checkUpdates",
      title: "Help: Check for Updates",
      category: "Settings",
      keywords: "updater release",
      run: () => {
        useSettingsStore.getState().openSettings("about");
        void import("@/stores/updaterStore").then(({ useUpdaterStore }) => {
          void useUpdaterStore.getState().check();
        });
      },
    },
  ];
}

export function runCommandById(id: string): boolean {
  const cmd = getCommands().find((c) => c.id === id);
  if (!cmd) return false;
  void cmd.run();
  usePaletteStore.getState().rememberCommand(id);
  return true;
}
