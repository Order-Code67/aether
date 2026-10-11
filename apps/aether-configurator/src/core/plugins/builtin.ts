/**
 * Built-in plugin — registers core tabs so third-party packs can extend the same registry.
 */

import { registerPlugin } from "./registry";
import type { AetherPlugin } from "./types";

export const builtinPlugin: AetherPlugin = {
  id: "aether.core",
  name: "Aether Core",
  version: "0.1.0",
  crafts: [
    {
      id: "multirotor",
      kind: "multirotor",
      label: "Multirotor",
      protocols: ["msp", "mavlink"],
    },
    {
      id: "plane",
      kind: "plane",
      label: "Airplane",
      protocols: ["msp", "mavlink"],
    },
    {
      id: "vtol",
      kind: "vtol",
      label: "VTOL",
      protocols: ["msp", "mavlink"],
    },
    {
      id: "rover",
      kind: "rover",
      label: "Rover",
      protocols: ["mavlink"],
    },
  ],
  tabs: [
    { id: "dashboard", labelKey: "tabs.dashboard", order: 10, component: () => null },
    { id: "setup", labelKey: "tabs.setup", order: 20, component: () => null },
    { id: "ports", labelKey: "tabs.ports", order: 30, component: () => null },
    {
      id: "pid",
      labelKey: "tabs.pid",
      order: 40,
      protocols: ["msp"],
      component: () => null,
    },
    {
      id: "modes",
      labelKey: "tabs.modes",
      order: 50,
      protocols: ["msp"],
      component: () => null,
    },
    { id: "motors", labelKey: "tabs.motors", order: 60, component: () => null },
    {
      id: "osd",
      labelKey: "tabs.osd",
      order: 70,
      protocols: ["msp"],
      component: () => null,
    },
    { id: "navigation", labelKey: "tabs.navigation", order: 80, component: () => null },
    { id: "parameters", labelKey: "tabs.parameters", order: 90, component: () => null },
    { id: "blackbox", labelKey: "tabs.blackbox", order: 100, component: () => null },
    { id: "cli", labelKey: "tabs.cli", order: 110, component: () => null },
    { id: "flasher", labelKey: "tabs.flasher", order: 120, component: () => null },
    { id: "profiles", labelKey: "tabs.profiles", order: 130, component: () => null },
    { id: "about", labelKey: "tabs.about", order: 200, component: () => null },
  ],
};

export function activateBuiltinPlugins(): void {
  registerPlugin(builtinPlugin);
}
