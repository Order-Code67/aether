/**
 * Modes / AUX assignment state — MSP read/write (RAM only).
 */

import { create } from "zustand";
import {
  MSP_BOXIDS,
  MSP_BOXNAMES,
  MSP_MODE_RANGES,
  MSP_RC,
  MSP_SET_MODE_RANGE,
} from "@/core/protocols/msp/commands";
import {
  encodeSetModeRange,
  emptyModeRange,
  isRangeActive,
  parseBoxIds,
  parseBoxNames,
  parseModeRanges,
  type MspModeRange,
  type MspModesSnapshot,
} from "@/core/protocols/msp/modes";
import { parseRcChannels } from "@/core/protocols/msp/telemetry";
import { getActiveMspClient } from "@/stores/connectionStore";

interface ModesState {
  snapshot: MspModesSnapshot | null;
  draft: MspModeRange[];
  /** Live RC PWM channels (index 0 = Roll). AUX1 = channels[4]. */
  rcChannels: number[];
  liveRc: boolean;
  busy: boolean;
  dirty: boolean;
  showAll: boolean;
  notice: string | null;
  error: string | null;

  load: () => Promise<void>;
  write: () => Promise<void>;
  updateRange: (index: number, patch: Partial<MspModeRange>) => void;
  clearRange: (index: number) => void;
  setShowAll: (v: boolean) => void;
  startLiveRc: () => void;
  stopLiveRc: () => void;
  clearMessages: () => void;
}

let rcUnsub: (() => void) | null = null;
let rcTimer: ReturnType<typeof setInterval> | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export const useModesStore = create<ModesState>((set, get) => ({
  snapshot: null,
  draft: [],
  rcChannels: [],
  liveRc: false,
  busy: false,
  dirty: false,
  showAll: false,
  notice: null,
  error: null,

  clearMessages: () => set({ notice: null, error: null }),
  setShowAll: (showAll) => set({ showAll }),

  load: async () => {
    const client = getActiveMspClient();
    if (!client) {
      set({ error: "NOT_CONNECTED" });
      return;
    }
    set({ busy: true, error: null, notice: null });
    try {
      const namesFrame = await client.requestResponse(MSP_BOXNAMES, [], 1200);
      const idsFrame = await client.requestResponse(MSP_BOXIDS, [], 1200);
      const rangesFrame = await client.requestResponse(MSP_MODE_RANGES, [], 1200);

      if (!namesFrame && !idsFrame && !rangesFrame) {
        set({
          busy: false,
          error: "MODES_NO_RESPONSE",
          snapshot: null,
          draft: [],
        });
        return;
      }

      const snapshot: MspModesSnapshot = {
        boxNames: namesFrame ? parseBoxNames(namesFrame.payload) : [],
        boxIds: idsFrame ? parseBoxIds(idsFrame.payload) : [],
        ranges: rangesFrame ? parseModeRanges(rangesFrame.payload) : [],
      };

      set({
        busy: false,
        snapshot,
        draft: snapshot.ranges.map((r) => ({ ...r })),
        dirty: false,
        notice: "MODES_LOADED",
        error: null,
      });
    } catch (e) {
      set({
        busy: false,
        error: e instanceof Error ? e.message : "MODES_LOAD_FAILED",
      });
    }
  },

  write: async () => {
    const client = getActiveMspClient();
    const { draft, snapshot } = get();
    if (!client || !snapshot) {
      set({ error: "NOT_CONNECTED" });
      return;
    }
    if (client.getSnapshot().status?.armed) {
      set({ error: "ARMED" });
      return;
    }
    set({ busy: true, error: null, notice: null });
    try {
      for (const range of draft) {
        await client.request(MSP_SET_MODE_RANGE, encodeSetModeRange(range));
        await sleep(40);
      }
      set({
        busy: false,
        dirty: false,
        notice: "MODES_WRITTEN",
        snapshot: { ...snapshot, ranges: draft.map((r) => ({ ...r })) },
      });
    } catch (e) {
      set({
        busy: false,
        error: e instanceof Error ? e.message : "MODES_WRITE_FAILED",
      });
    }
  },

  updateRange: (index, patch) => {
    set((s) => ({
      draft: s.draft.map((r) => (r.index === index ? { ...r, ...patch } : r)),
      dirty: true,
    }));
  },

  clearRange: (index) => {
    set((s) => ({
      draft: s.draft.map((r) =>
        r.index === index ? emptyModeRange(index) : r,
      ),
      dirty: true,
    }));
  },

  startLiveRc: () => {
    get().stopLiveRc();
    const client = getActiveMspClient();
    if (!client) return;

    rcUnsub = client.onFrame((frame) => {
      if (frame.cmd !== MSP_RC) return;
      const rc = parseRcChannels(frame.payload);
      if (rc) set({ rcChannels: rc.channels });
    });
    set({ liveRc: true });

    const tick = () => {
      const c = getActiveMspClient();
      if (!c || !get().liveRc) return;
      void c.request(MSP_RC);
    };
    void tick();
    rcTimer = setInterval(tick, 300);
  },

  stopLiveRc: () => {
    if (rcTimer) {
      clearInterval(rcTimer);
      rcTimer = null;
    }
    rcUnsub?.();
    rcUnsub = null;
    set({ liveRc: false });
  },
}));

/** Visible rows for the Modes table. */
export function visibleModeRanges(
  draft: MspModeRange[],
  showAll: boolean,
): MspModeRange[] {
  if (showAll) return draft;
  const active = draft.filter(isRangeActive);
  return active.length > 0 ? active : draft.slice(0, 8);
}
