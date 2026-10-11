/**
 * Setup / Calibration live telemetry — fed by MSP when the Setup tab is active.
 */

import { create } from "zustand";
import {
  MSP_ATTITUDE,
  MSP_RAW_IMU,
  MSP_RC,
  MSP_STATUS,
  MSP_STATUS_EX,
} from "@/core/protocols/msp/commands";
import type { MspFrame } from "@/core/protocols/msp/codec";
import {
  parseAttitude,
  parseRawImu,
  parseRcChannels,
  type AttitudeSnapshot,
  type RawImuSnapshot,
  type RcChannels,
} from "@/core/protocols/msp/telemetry";
import { getActiveMspClient } from "@/stores/connectionStore";

type CalKind = "acc" | "mag" | null;

interface SetupState {
  live: boolean;
  attitude: AttitudeSnapshot | null;
  rc: RcChannels | null;
  imu: RawImuSnapshot | null;
  busy: boolean;
  notice: string | null;
  error: string | null;
  lastCal: CalKind;
  startLive: () => void;
  stopLive: () => void;
  calibrateAcc: () => Promise<void>;
  calibrateMag: () => Promise<void>;
  clearNotice: () => void;
}

let unsubFrame: (() => void) | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

function ingestFrame(frame: MspFrame, set: (partial: Partial<SetupState>) => void): void {
  switch (frame.cmd) {
    case MSP_ATTITUDE: {
      const attitude = parseAttitude(frame.payload);
      if (attitude) set({ attitude });
      break;
    }
    case MSP_RC: {
      const rc = parseRcChannels(frame.payload);
      if (rc) set({ rc });
      break;
    }
    case MSP_RAW_IMU: {
      const imu = parseRawImu(frame.payload);
      if (imu) set({ imu });
      break;
    }
    case MSP_STATUS:
    case MSP_STATUS_EX:
      // Status also updates connectionStore via MspClient snapshot path.
      break;
    default:
      break;
  }
}

export const useSetupStore = create<SetupState>((set, get) => ({
  live: false,
  attitude: null,
  rc: null,
  imu: null,
  busy: false,
  notice: null,
  error: null,
  lastCal: null,

  startLive: () => {
    get().stopLive();
    const client = getActiveMspClient();
    if (!client) {
      set({ error: "NOT_CONNECTED", live: false });
      return;
    }

    unsubFrame = client.onFrame((frame) => ingestFrame(frame, set));
    set({ live: true, error: null });

    const tick = () => {
      const c = getActiveMspClient();
      if (!c || !get().live) return;
      void c.pollSetupLive().catch((e) => {
        set({
          error: e instanceof Error ? e.message : "SETUP_POLL_FAILED",
        });
      });
    };
    void tick();
    pollTimer = setInterval(tick, 250);
  },

  stopLive: () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    unsubFrame?.();
    unsubFrame = null;
    set({ live: false });
  },

  calibrateAcc: async () => {
    const client = getActiveMspClient();
    if (!client) {
      set({ error: "NOT_CONNECTED" });
      return;
    }
    set({ busy: true, error: null, notice: null });
    const result = await client.calibrateAccelerometer();
    if (!result.ok) {
      set({
        busy: false,
        error: result.error,
        lastCal: null,
      });
      return;
    }
    set({
      busy: false,
      lastCal: "acc",
      notice: "ACC_OK",
    });
  },

  calibrateMag: async () => {
    const client = getActiveMspClient();
    if (!client) {
      set({ error: "NOT_CONNECTED" });
      return;
    }
    set({ busy: true, error: null, notice: null });
    const result = await client.calibrateMagnetometer();
    if (!result.ok) {
      set({
        busy: false,
        error: result.error,
        lastCal: null,
      });
      return;
    }
    set({
      busy: false,
      lastCal: "mag",
      notice: "MAG_OK",
    });
  },

  clearNotice: () => set({ notice: null, error: null }),
}));
