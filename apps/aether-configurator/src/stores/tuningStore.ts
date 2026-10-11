/**
 * PID / Rates / Filters state — MSP read/write (RAM only).
 */

import { create } from "zustand";
import {
  MSP_FILTER_CONFIG,
  MSP_PID,
  MSP_RC_TUNING,
  MSP_SET_FILTER_CONFIG,
  MSP_SET_PID,
  MSP_SET_RC_TUNING,
} from "@/core/protocols/msp/commands";
import {
  encodeFilterConfig,
  encodeLegacyPid,
  encodeRcTuning,
  emptyFilters,
  emptyPid,
  emptyRates,
  parseFilterConfig,
  parseLegacyPid,
  parseRcTuning,
  type AxisId,
  type FilterConfig,
  type PidAxis,
  type PidProfile,
  type RatesProfile,
} from "@/core/protocols/msp/tuning";
import { getActiveMspClient } from "@/stores/connectionStore";

interface TuningState {
  pid: PidProfile | null;
  rates: RatesProfile | null;
  filters: FilterConfig | null;
  busy: boolean;
  notice: string | null;
  error: string | null;
  dirty: { pid: boolean; rates: boolean; filters: boolean };

  loadAll: () => Promise<void>;
  setPidGain: (axis: AxisId, gain: keyof PidAxis, value: number) => void;
  setRate: (key: keyof Omit<RatesProfile, "raw">, value: number) => void;
  setFilter: (key: keyof Omit<FilterConfig, "raw">, value: number) => void;
  writePid: () => Promise<void>;
  writeRates: () => Promise<void>;
  writeFilters: () => Promise<void>;
  clearMessages: () => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export const useTuningStore = create<TuningState>((set, get) => ({
  pid: null,
  rates: null,
  filters: null,
  busy: false,
  notice: null,
  error: null,
  dirty: { pid: false, rates: false, filters: false },

  clearMessages: () => set({ notice: null, error: null }),

  loadAll: async () => {
    const client = getActiveMspClient();
    if (!client) {
      set({ error: "NOT_CONNECTED" });
      return;
    }
    set({ busy: true, error: null, notice: null });

    try {
      const pidFrame = await client.requestResponse(MSP_PID);
      const ratesFrame = await client.requestResponse(MSP_RC_TUNING);
      const filterFrame = await client.requestResponse(MSP_FILTER_CONFIG);

      const pid = pidFrame ? parseLegacyPid(pidFrame.payload) : null;
      const rates = ratesFrame ? parseRcTuning(ratesFrame.payload) : null;
      const filters = filterFrame
        ? parseFilterConfig(filterFrame.payload)
        : null;

      if (!pid && !rates && !filters) {
        set({
          busy: false,
          error: "TUNING_NO_RESPONSE",
          pid: emptyPid(),
          rates: emptyRates(),
          filters: emptyFilters(),
          dirty: { pid: false, rates: false, filters: false },
        });
        return;
      }

      set({
        busy: false,
        pid: pid ?? emptyPid(),
        rates: rates ?? emptyRates(),
        filters: filters ?? emptyFilters(),
        dirty: { pid: false, rates: false, filters: false },
        notice: "TUNING_LOADED",
        error: null,
      });
    } catch (e) {
      set({
        busy: false,
        error: e instanceof Error ? e.message : "TUNING_LOAD_FAILED",
      });
    }
  },

  setPidGain: (axis, gain, value) => {
    set((s) => {
      if (!s.pid) return s;
      return {
        pid: {
          ...s.pid,
          [axis]: { ...s.pid[axis], [gain]: value },
        },
        dirty: { ...s.dirty, pid: true },
      };
    });
  },

  setRate: (key, value) => {
    set((s) => {
      if (!s.rates) return s;
      return {
        rates: { ...s.rates, [key]: value },
        dirty: { ...s.dirty, rates: true },
      };
    });
  },

  setFilter: (key, value) => {
    set((s) => {
      if (!s.filters) return s;
      return {
        filters: { ...s.filters, [key]: value },
        dirty: { ...s.dirty, filters: true },
      };
    });
  },

  writePid: async () => {
    const client = getActiveMspClient();
    const { pid } = get();
    if (!client || !pid) {
      set({ error: "NOT_CONNECTED" });
      return;
    }
    if (client.getSnapshot().status?.armed) {
      set({ error: "ARMED" });
      return;
    }
    set({ busy: true, error: null, notice: null });
    try {
      await client.request(MSP_SET_PID, encodeLegacyPid(pid));
      await sleep(80);
      set({
        busy: false,
        notice: "PID_WRITTEN",
        dirty: { ...get().dirty, pid: false },
      });
    } catch (e) {
      set({
        busy: false,
        error: e instanceof Error ? e.message : "PID_WRITE_FAILED",
      });
    }
  },

  writeRates: async () => {
    const client = getActiveMspClient();
    const { rates } = get();
    if (!client || !rates) {
      set({ error: "NOT_CONNECTED" });
      return;
    }
    if (client.getSnapshot().status?.armed) {
      set({ error: "ARMED" });
      return;
    }
    set({ busy: true, error: null, notice: null });
    try {
      await client.request(MSP_SET_RC_TUNING, encodeRcTuning(rates));
      await sleep(80);
      set({
        busy: false,
        notice: "RATES_WRITTEN",
        dirty: { ...get().dirty, rates: false },
      });
    } catch (e) {
      set({
        busy: false,
        error: e instanceof Error ? e.message : "RATES_WRITE_FAILED",
      });
    }
  },

  writeFilters: async () => {
    const client = getActiveMspClient();
    const { filters } = get();
    if (!client || !filters) {
      set({ error: "NOT_CONNECTED" });
      return;
    }
    if (client.getSnapshot().status?.armed) {
      set({ error: "ARMED" });
      return;
    }
    set({ busy: true, error: null, notice: null });
    try {
      await client.request(MSP_SET_FILTER_CONFIG, encodeFilterConfig(filters));
      await sleep(80);
      set({
        busy: false,
        notice: "FILTERS_WRITTEN",
        dirty: { ...get().dirty, filters: false },
      });
    } catch (e) {
      set({
        busy: false,
        error: e instanceof Error ? e.message : "FILTERS_WRITE_FAILED",
      });
    }
  },
}));
