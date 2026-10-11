export type InavConfiguratorTab =
  | "setup"
  | "pid"
  | "rates"
  | "receiver"
  | "battery"
  | "failsafe"
  | "gps"
  | "mixer"
  | "ports"
  | "modes"
  | "params"
  | "presets"
  | "cli"
  | "diff"
  | "flash";

export const INAV_CONFIGURATOR_TABS: {
  id: InavConfiguratorTab;
  /** i18n key */
  labelKey: string;
}[] = [
  { id: "setup", labelKey: "inav.tab.setup" },
  { id: "pid", labelKey: "inav.tab.pid" },
  { id: "rates", labelKey: "inav.tab.rates" },
  { id: "receiver", labelKey: "inav.tab.receiver" },
  { id: "battery", labelKey: "inav.tab.battery" },
  { id: "failsafe", labelKey: "inav.tab.failsafe" },
  { id: "gps", labelKey: "inav.tab.gps" },
  { id: "mixer", labelKey: "inav.tab.mixer" },
  { id: "ports", labelKey: "inav.tab.ports" },
  { id: "modes", labelKey: "inav.tab.modes" },
  { id: "params", labelKey: "inav.tab.params" },
  { id: "presets", labelKey: "inav.tab.presets" },
  { id: "cli", labelKey: "inav.tab.cli" },
  { id: "diff", labelKey: "inav.tab.diff" },
  { id: "flash", labelKey: "inav.tab.flash" },
];
