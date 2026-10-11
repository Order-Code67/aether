import { create } from "zustand";
import {
  craftFromMavType,
  encodeParamRequestList,
  MAVLINK_MSG_HEARTBEAT,
  MAVLINK_MSG_PARAM_VALUE,
  MavlinkParser,
  parseHeartbeat,
  parseParamValue,
} from "@/core/protocols/mavlink/codec";
import { getActiveMspClient } from "@/stores/connectionStore";
import { useConnectionStore } from "@/stores/connectionStore";

export interface ParamEntry {
  name: string;
  value: string;
  group: string;
  source: "cli" | "mavlink";
}

interface ParamsState {
  params: ParamEntry[];
  query: string;
  busy: boolean;
  craftLabel: string | null;
  notice: string | null;
  error: string | null;
  setQuery: (q: string) => void;
  loadCli: () => Promise<void>;
  loadMavlink: () => Promise<void>;
  filtered: () => ParamEntry[];
  groups: () => string[];
}

function groupOf(name: string): string {
  const i = name.indexOf("_");
  return i > 0 ? name.slice(0, i).toUpperCase() : "MISC";
}

function parseCliDiff(text: string): ParamEntry[] {
  const out: ParamEntry[] = [];
  const re = /^\s*set\s+([A-Za-z0-9_]+)\s*=\s*(.+?)\s*$/gim;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const name = m[1]!;
    out.push({
      name,
      value: m[2]!.trim(),
      group: groupOf(name),
      source: "cli",
    });
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export const useParamsStore = create<ParamsState>((set, get) => ({
  params: [],
  query: "",
  busy: false,
  craftLabel: null,
  notice: null,
  error: null,

  setQuery: (query) => set({ query }),

  filtered: () => {
    const q = get().query.trim().toLowerCase();
    const all = get().params;
    if (!q) return all;
    return all.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.value.toLowerCase().includes(q) ||
        p.group.toLowerCase().includes(q),
    );
  },

  groups: () => {
    const setG = new Set(get().filtered().map((p) => p.group));
    return [...setG].sort();
  },

  loadCli: async () => {
    if (!getActiveMspClient()) {
      set({ error: "NOT_CONNECTED" });
      return;
    }
    set({ busy: true, error: null, notice: null });
    try {
      const chunks: string[] = [];
      const off = window.aether?.serial.onData((d) => chunks.push(d));
      await window.aether?.serial.write("#\n");
      await sleep(60);
      await window.aether?.serial.write("diff all\n");
      await sleep(2200);
      await window.aether?.serial.write("exit\n");
      await sleep(200);
      off?.();
      const params = parseCliDiff(chunks.join(""));
      if (params.length === 0) {
        set({ busy: false, error: "PARAMS_EMPTY", params: [] });
        return;
      }
      set({
        busy: false,
        params,
        notice: "PARAMS_LOADED_CLI",
        craftLabel: useConnectionStore.getState().snapshot.fcVariant,
      });
    } catch (e) {
      set({
        busy: false,
        error: e instanceof Error ? e.message : "PARAMS_LOAD_FAILED",
      });
    }
  },

  loadMavlink: async () => {
    const protocol = useConnectionStore.getState().protocol;
    if (!window.aether) {
      set({ error: "NOT_CONNECTED" });
      return;
    }
    set({ busy: true, error: null, notice: null });
    const parser = new MavlinkParser();
    const collected = new Map<string, ParamEntry>();
    let craft: string | null = null;

    const onBytes = (bytes: number[]) => {
      const frames = parser.push(Uint8Array.from(bytes));
      for (const f of frames) {
        if (f.msgid === MAVLINK_MSG_HEARTBEAT) {
          const hb = parseHeartbeat(f.payload);
          if (hb) craft = craftFromMavType(hb.type);
        }
        if (f.msgid === MAVLINK_MSG_PARAM_VALUE) {
          const pv = parseParamValue(f.payload);
          if (pv?.paramId) {
            collected.set(pv.paramId, {
              name: pv.paramId,
              value: String(pv.paramValue),
              group: groupOf(pv.paramId),
              source: "mavlink",
            });
          }
        }
      }
    };

    const unsubNet = window.aether.net.onBytes(onBytes);
    const unsubSerial = window.aether.serial.onBytes(onBytes);
    try {
      const req = encodeParamRequestList();
      if (protocol === "mavlink" || useConnectionStore.getState().mode !== "serial") {
        await window.aether.net.writeBytes(Array.from(req));
      } else {
        await window.aether.serial.writeBytes(Array.from(req));
      }
      await sleep(3500);
      const params = [...collected.values()].sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      if (params.length === 0) {
        set({
          busy: false,
          error: "MAVLINK_NO_PARAMS",
          craftLabel: craft,
        });
        return;
      }
      set({
        busy: false,
        params,
        craftLabel: craft,
        notice: "PARAMS_LOADED_MAV",
      });
    } catch (e) {
      set({
        busy: false,
        error: e instanceof Error ? e.message : "MAVLINK_PARAM_FAILED",
      });
    } finally {
      unsubNet();
      unsubSerial();
    }
  },
}));
