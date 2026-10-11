/**
 * Plugin contracts — add protocols, craft types, and UI tabs without rewriting the core.
 */

import type { ComponentType } from "react";

export type CraftKind =
  | "multirotor"
  | "plane"
  | "vtol"
  | "rover"
  | "boat"
  | "sub"
  | "unknown";

export type ProtocolId = "msp" | "mavlink" | string;

export type TabId =
  | "dashboard"
  | "setup"
  | "ports"
  | "pid"
  | "modes"
  | "motors"
  | "osd"
  | "navigation"
  | "parameters"
  | "blackbox"
  | "cli"
  | "flasher"
  | "profiles"
  | "about"
  | (string & {});

export interface TabDefinition {
  id: TabId;
  /** i18n key under tabs.* */
  labelKey: string;
  icon?: string;
  /** Optional protocol / craft filters — empty means always visible. */
  protocols?: ProtocolId[];
  crafts?: CraftKind[];
  component: ComponentType;
  /** Sort order in sidebar (lower first). */
  order: number;
  /** When true, tab is a stub ready for future implementation. */
  stub?: boolean;
}

export interface ProtocolAdapter {
  id: ProtocolId;
  label: string;
  /** Connect / probe identity of the FC. */
  probe(): Promise<{ ok: boolean; detail?: string }>;
  /** Tear down timers / parsers. */
  dispose(): void;
}

export interface CraftProfile {
  id: string;
  kind: CraftKind;
  label: string;
  protocols: ProtocolId[];
}

export interface AetherPlugin {
  id: string;
  name: string;
  version: string;
  tabs?: TabDefinition[];
  protocols?: ProtocolAdapter[];
  crafts?: CraftProfile[];
  activate?(): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}
