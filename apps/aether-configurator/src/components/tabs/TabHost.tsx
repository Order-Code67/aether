import { useUiStore } from "@/stores/uiStore";
import { DashboardTab } from "./DashboardTab";
import { SetupTab } from "./SetupTab";
import { PortsTab } from "./PortsTab";
import { PidTab } from "./PidTab";
import { ModesTab } from "./ModesTab";
import { MotorsTab } from "./MotorsTab";
import { OsdTab } from "./OsdTab";
import { NavigationTab } from "./NavigationTab";
import { ParametersTab } from "./ParametersTab";
import { BlackboxTab } from "./BlackboxTab";
import { CliTab } from "./CliTab";
import { FlasherTab } from "./FlasherTab";
import { ProfilesTab } from "./ProfilesTab";
import { AboutTab } from "./AboutTab";

export function TabHost() {
  const activeTab = useUiStore((s) => s.activeTab);

  switch (activeTab) {
    case "dashboard":
      return <DashboardTab />;
    case "setup":
      return <SetupTab />;
    case "ports":
      return <PortsTab />;
    case "pid":
      return <PidTab />;
    case "modes":
      return <ModesTab />;
    case "motors":
      return <MotorsTab />;
    case "osd":
      return <OsdTab />;
    case "navigation":
      return <NavigationTab />;
    case "parameters":
      return <ParametersTab />;
    case "blackbox":
      return <BlackboxTab />;
    case "cli":
      return <CliTab />;
    case "flasher":
      return <FlasherTab />;
    case "profiles":
      return <ProfilesTab />;
    case "about":
      return <AboutTab />;
    default:
      return <DashboardTab />;
  }
}
