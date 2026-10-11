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
  | "iNav"
  | "БПЛА-Студия"
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
      id: "help.quickStart",
      title:
        useSettingsStore.getState().locale === "ru"
          ? "Быстрый старт"
          : "Quick start",
      category: "Settings",
      keywords: "onboarding wizard 60s быстрый старт quick start",
      run: () => {
        usePaletteStore.getState().requestOnboarding();
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
      id: "file.openInVsCode",
      title: "Open in VS Code",
      category: "File",
      keywords: "vscode visual studio code открыть",
      run: async () => {
        const { t } = await import("@/hooks/useI18n");
        const {
          notifyVsCodeFailure,
          openInVsCode,
          vscodeErrorKey,
          VSCODE_NOTICE_MS,
        } = await import("@/lib/vscodeIntegration");
        let folder = useWorkspaceStore.getState().rootPath;
        if (!folder) {
          await useWorkspaceStore.getState().openFolder();
          folder = useWorkspaceStore.getState().rootPath;
        }
        if (!folder) {
          notifyVsCodeFailure(t("vscode.needFolder"));
          return;
        }
        try {
          await openInVsCode(folder);
          useSettingsStore
            .getState()
            .flashNotice(t("vscode.opened"), VSCODE_NOTICE_MS);
        } catch (err) {
          notifyVsCodeFailure(t(vscodeErrorKey(err)));
        }
      },
    },
    {
      id: "file.generateVsCodeConfig",
      title: "Generate VS Code Config",
      category: "File",
      keywords: "vscode extensions.json intellisense конфиг",
      run: async () => {
        const { t } = await import("@/hooks/useI18n");
        const { errorMessage } = await import("@/lib/errors");
        const {
          formatGenerateSummary,
          generateVsCodeConfig,
          notifyVsCodeFailure,
          VSCODE_NOTICE_MS,
        } = await import("@/lib/vscodeIntegration");
        let folder = useWorkspaceStore.getState().rootPath;
        if (!folder) {
          await useWorkspaceStore.getState().openFolder();
          folder = useWorkspaceStore.getState().rootPath;
        }
        if (!folder) {
          notifyVsCodeFailure(t("vscode.needFolder"));
          return;
        }
        try {
          const result = await generateVsCodeConfig(folder);
          const summary = formatGenerateSummary(result, t);
          useSettingsStore
            .getState()
            .flashNotice(summary.replace(/\n/g, " · "), VSCODE_NOTICE_MS);
          window.alert(`${t("vscode.generateDone")}\n\n${summary}`);
        } catch (err) {
          notifyVsCodeFailure(
            errorMessage(err, t("vscode.generateFailed")),
          );
        }
      },
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
      id: "view.libraries",
      title: "Show Libraries",
      category: "View",
      keywords: "arduino lib pkg",
      run: () => view("libraries"),
    },
    {
      id: "view.inav",
      title: "Show БПЛА-Студия bridge",
      category: "View",
      keywords: "drone flight fc inav кли дроны конфигуратор бпла студия",
      run: () => view("inav"),
    },
    {
      id: "inav.focus",
      title: "БПЛА-Студия: Focus bridge",
      category: "БПЛА-Студия",
      keywords: "drone flight fc inav дроны",
      run: () => view("inav"),
    },
    {
      id: "inav.connect",
      title: "БПЛА-Студия: Open with COM handoff",
      category: "БПЛА-Студия",
      keywords: "drone serial com connect подключить aether bpla",
      run: async () => {
        view("inav");
        const { useInavStore } = await import("@/stores/inavStore");
        const { useSerialStore } = await import("@/stores/serialStore");
        const { openBplaStudio } = await import("@/lib/bplaStudio");
        const { t } = await import("@/hooks/useI18n");
        await useInavStore.getState().releasePort();
        const serial = useSerialStore.getState();
        try {
          await openBplaStudio({
            port: serial.selectedPath || undefined,
            baud: serial.baudRate,
          });
          useSettingsStore.getState().flashNotice(t("studio.bridge.launched"));
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          useSettingsStore
            .getState()
            .flashNotice(
              msg.includes("BPLA_STUDIO_MISSING")
                ? t("studio.bridge.missing")
                : msg,
            );
        }
      },
    },
    {
      id: "inav.disconnect",
      title: "БПЛА-Студия: Release COM in Aether",
      category: "БПЛА-Студия",
      keywords: "drone serial disconnect отключить",
      run: async () => {
        const { useInavStore } = await import("@/stores/inavStore");
        await useInavStore.getState().releasePort();
      },
    },
    {
      id: "inav.openConfigurator",
      title: "БПЛА-Студия: Open",
      category: "БПЛА-Студия",
      keywords: "configurator bpla студия конфигуратор",
      run: async () => {
        view("inav");
        const { useInavStore } = await import("@/stores/inavStore");
        const { useSerialStore } = await import("@/stores/serialStore");
        const { openBplaStudio } = await import("@/lib/bplaStudio");
        const { t } = await import("@/hooks/useI18n");
        await useInavStore.getState().releasePort();
        const serial = useSerialStore.getState();
        try {
          await openBplaStudio({
            port: serial.selectedPath || undefined,
            baud: serial.baudRate,
          });
          useSettingsStore.getState().flashNotice(t("studio.bridge.launched"));
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          useSettingsStore
            .getState()
            .flashNotice(
              msg.includes("BPLA_STUDIO_MISSING")
                ? t("studio.bridge.missing")
                : msg,
            );
        }
      },
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
      id: "view.plotter",
      title: "Show Serial Plotter",
      category: "View",
      keywords: "plot chart graph serial плоттер график",
      run: () => bottom("plotter"),
    },
    {
      id: "view.camera",
      title: "Show Camera",
      category: "View",
      keywords: "esp32-cam mjpeg jpeg stream камера",
      run: () => bottom("camera"),
    },
    {
      id: "view.debugConsole",
      title: "Show Debug Console",
      category: "View",
      run: () => bottom("debug"),
    },
    {
      id: "pio.saveFirmwareProfile",
      title: "PlatformIO: Save Firmware Profile…",
      category: "PlatformIO",
      keywords: "profile preset board port профиль прошивка",
      run: async () => {
        const { t } = await import("@/hooks/useI18n");
        const { useFirmwareProfileStore } = await import(
          "@/stores/firmwareProfileStore"
        );
        const pio = usePlatformIoStore.getState();
        const { useSerialStore } = await import("@/stores/serialStore");
        const root = useWorkspaceStore.getState().rootPath;
        const port =
          (root && pio.uploadPortByRoot[root]) ||
          useSerialStore.getState().selectedPath ||
          "";
        const defaultName =
          (pio.selectedEnv || "env") + (port ? ` · ${port}` : "");
        const name = window.prompt(t("profiles.namePlaceholder"), defaultName);
        if (!name?.trim()) return;
        const id = useFirmwareProfileStore.getState().saveCurrentAs(name.trim());
        if (!id) {
          useSettingsStore.getState().flashNotice(t("profiles.needProject"));
          return;
        }
        useSettingsStore
          .getState()
          .flashNotice(t("profiles.saved", { name: name.trim() }));
      },
    },
    {
      id: "pio.applyFirmwareProfile",
      title: "PlatformIO: Apply Firmware Profile…",
      category: "PlatformIO",
      keywords: "profile apply профиль применить",
      run: async () => {
        const { t } = await import("@/hooks/useI18n");
        const { useFirmwareProfileStore } = await import(
          "@/stores/firmwareProfileStore"
        );
        const profiles = useFirmwareProfileStore.getState().profiles;
        if (profiles.length === 0) {
          useSettingsStore.getState().flashNotice(t("profiles.empty"));
          return;
        }
        const list = profiles
          .map((p, i) => `${i + 1}. ${p.name} (${p.env || "—"} · ${p.uploadPort || "—"})`)
          .join("\n");
        const answer = window.prompt(
          `${t("profiles.title")}\n${list}\n\n#`,
          "1",
        );
        const idx = Number(answer) - 1;
        const profile = profiles[idx];
        if (!profile) return;
        await useFirmwareProfileStore.getState().applyProfile(profile.id);
      },
    },
    {
      id: "settings.firmwareProfiles",
      title: "Preferences: Firmware Profiles",
      category: "Settings",
      keywords: "firmware profile preset профили",
      run: () => useSettingsStore.getState().openSettings("general"),
    },
    {
      id: "pio.exportFirmwareProfiles",
      title: "PlatformIO: Export Firmware Profiles…",
      category: "PlatformIO",
      keywords: "profile export backup json профили экспорт",
      run: async () => {
        const { t } = await import("@/hooks/useI18n");
        const { useFirmwareProfileStore } = await import(
          "@/stores/firmwareProfileStore"
        );
        const { exportFirmwareProfilesToFile } = await import(
          "@/lib/firmwareProfilesFile"
        );
        const locale = useSettingsStore.getState().locale;
        const profiles = useFirmwareProfileStore.getState().profiles;
        if (profiles.length === 0) {
          useSettingsStore.getState().flashNotice(t("profiles.empty"));
          return;
        }
        try {
          const path = await exportFirmwareProfilesToFile(profiles, locale);
          if (path) {
            useSettingsStore
              .getState()
              .flashNotice(t("profiles.exported", { count: profiles.length }));
          }
        } catch (e) {
          useSettingsStore
            .getState()
            .flashNotice(
              e instanceof Error ? e.message : t("profiles.exportFailed"),
            );
        }
      },
    },
    {
      id: "pio.importFirmwareProfiles",
      title: "PlatformIO: Import Firmware Profiles…",
      category: "PlatformIO",
      keywords: "profile import merge json профили импорт",
      run: async () => {
        const { t } = await import("@/hooks/useI18n");
        const { useFirmwareProfileStore } = await import(
          "@/stores/firmwareProfileStore"
        );
        const { importFirmwareProfilesFromFile } = await import(
          "@/lib/firmwareProfilesFile"
        );
        const locale = useSettingsStore.getState().locale;
        try {
          const result = await importFirmwareProfilesFromFile(locale);
          if (!result.ok) {
            if ("cancelled" in result && result.cancelled) return;
            if ("errorKey" in result) {
              useSettingsStore.getState().flashNotice(t(result.errorKey));
            }
            return;
          }
          const replace = window.confirm(t("profiles.importConfirm"));
          if (replace) {
            useFirmwareProfileStore.getState().replaceProfiles(result.profiles);
          } else {
            useFirmwareProfileStore.getState().mergeProfiles(result.profiles);
          }
          useSettingsStore
            .getState()
            .flashNotice(
              t("profiles.imported", { count: result.profiles.length }),
            );
        } catch (e) {
          useSettingsStore
            .getState()
            .flashNotice(
              e instanceof Error ? e.message : t("profiles.importFailed"),
            );
        }
      },
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
          void useUpdaterStore.getState().check({ openDialog: true });
        });
      },
    },
    {
      id: "help.copySupportReport",
      title: "Help: Copy Support Report",
      category: "Settings",
      keywords: "support report clipboard диагностический отчёт",
      run: async () => {
        const { buildSupportReportText } = await import("@/lib/supportReport");
        const { copyTextToClipboard } = await import("@/lib/clipboard");
        const { t } = await import("@/hooks/useI18n");
        const locale = useSettingsStore.getState().locale;
        const text = await buildSupportReportText(locale);
        const ok = await copyTextToClipboard(text);
        useSettingsStore
          .getState()
          .flashNotice(ok ? t("support.copied") : t("support.copyFailed"));
      },
    },
    {
      id: "help.saveSupportReport",
      title: "Help: Save Support Report",
      category: "Settings",
      keywords: "support report save disk сохранить отчёт лог",
      run: async () => {
        const { saveSupportReportToDisk } = await import("@/lib/supportReport");
        const { t } = await import("@/hooks/useI18n");
        const locale = useSettingsStore.getState().locale;
        try {
          const path = await saveSupportReportToDisk(locale);
          if (!path) return;
          useSettingsStore
            .getState()
            .flashNotice(t("support.saved", { path }), 4500);
        } catch {
          useSettingsStore.getState().flashNotice(t("support.saveFailed"));
        }
      },
    },
  ];
}

export function runCommandById(id: string): boolean {
  const cmd = getCommands().find((c) => c.id === id);
  if (!cmd) {
    void import("@/hooks/useI18n").then(({ t }) => {
      useSettingsStore
        .getState()
        .flashNotice(t("command.unknown", { id }), 3500);
    });
    return false;
  }
  try {
    const result = cmd.run();
    if (result != null && typeof (result as Promise<void>).then === "function") {
      void (result as Promise<void>).catch((err) => {
        void Promise.all([
          import("@/hooks/useI18n"),
          import("@/lib/errors"),
        ]).then(([{ t }, { errorMessage }]) => {
          useSettingsStore.getState().flashNotice(
            t("command.failed", {
              message: errorMessage(err, String(err)),
            }),
            4500,
          );
        });
      });
    }
  } catch (err) {
    void Promise.all([import("@/hooks/useI18n"), import("@/lib/errors")]).then(
      ([{ t }, { errorMessage }]) => {
        useSettingsStore.getState().flashNotice(
          t("command.failed", {
            message: errorMessage(err, String(err)),
          }),
          4500,
        );
      },
    );
  }
  usePaletteStore.getState().rememberCommand(id);
  return true;
}
