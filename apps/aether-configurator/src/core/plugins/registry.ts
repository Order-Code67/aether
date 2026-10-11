/**
 * Lightweight plugin registry. Core registers built-in tabs; future packs call registerPlugin().
 */

import type { AetherPlugin, TabDefinition, ProtocolAdapter } from "./types";

const plugins = new Map<string, AetherPlugin>();
const tabs = new Map<string, TabDefinition>();
const protocols = new Map<string, ProtocolAdapter>();

export function registerPlugin(plugin: AetherPlugin): void {
  if (plugins.has(plugin.id)) {
    console.warn(`[plugins] replacing plugin ${plugin.id}`);
  }
  plugins.set(plugin.id, plugin);
  for (const tab of plugin.tabs ?? []) {
    tabs.set(tab.id, tab);
  }
  for (const proto of plugin.protocols ?? []) {
    protocols.set(proto.id, proto);
  }
  void plugin.activate?.();
}

export function unregisterPlugin(id: string): void {
  const plugin = plugins.get(id);
  if (!plugin) return;
  void plugin.deactivate?.();
  for (const tab of plugin.tabs ?? []) tabs.delete(tab.id);
  for (const proto of plugin.protocols ?? []) protocols.delete(proto.id);
  plugins.delete(id);
}

export function listTabs(): TabDefinition[] {
  return [...tabs.values()].sort((a, b) => a.order - b.order);
}

export function getTab(id: string): TabDefinition | undefined {
  return tabs.get(id);
}

export function listProtocols(): ProtocolAdapter[] {
  return [...protocols.values()];
}

export function getProtocol(id: string): ProtocolAdapter | undefined {
  return protocols.get(id);
}

export function listPlugins(): AetherPlugin[] {
  return [...plugins.values()];
}
