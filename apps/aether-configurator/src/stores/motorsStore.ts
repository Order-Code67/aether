import { create } from "zustand";
import { MSP_MOTOR, MSP_SET_MOTOR } from "@/core/protocols/msp/commands";
import {
  encodeSetMotor,
  MOTOR_STOP,
  MOTOR_TEST_MAX,
  parseMotorValues,
  stoppedMotors,
} from "@/core/protocols/msp/motors";
import { getActiveMspClient } from "@/stores/connectionStore";

const ENABLE_TIMEOUT_MS = 12_000;

interface MotorsState {
  propsRemoved: boolean;
  masterEnable: boolean;
  values: number[];
  telemetry: number[];
  busy: boolean;
  error: string | null;
  notice: string | null;
  setPropsRemoved: (v: boolean) => void;
  enableMaster: () => void;
  disableMaster: () => void;
  setMotor: (index: number, value: number) => void;
  stopAll: () => Promise<void>;
  refreshTelemetry: () => Promise<void>;
  send: () => Promise<void>;
}

let enableTimer: ReturnType<typeof setTimeout> | null = null;

export const useMotorsStore = create<MotorsState>((set, get) => ({
  propsRemoved: false,
  masterEnable: false,
  values: stoppedMotors(),
  telemetry: stoppedMotors(),
  busy: false,
  error: null,
  notice: null,

  setPropsRemoved: (propsRemoved) => {
    if (!propsRemoved) {
      get().disableMaster();
      void get().stopAll();
    }
    set({ propsRemoved });
  },

  enableMaster: () => {
    if (!get().propsRemoved) {
      set({ error: "PROPS_REQUIRED" });
      return;
    }
    const client = getActiveMspClient();
    if (client?.getSnapshot().status?.armed) {
      set({ error: "ARMED" });
      return;
    }
    if (enableTimer) clearTimeout(enableTimer);
    set({ masterEnable: true, error: null, notice: "MASTER_ON" });
    enableTimer = setTimeout(() => {
      void get().disableMaster();
      set({ notice: "MASTER_TIMEOUT" });
    }, ENABLE_TIMEOUT_MS);
  },

  disableMaster: () => {
    if (enableTimer) {
      clearTimeout(enableTimer);
      enableTimer = null;
    }
    set({ masterEnable: false, values: stoppedMotors() });
    void get().stopAll();
  },

  setMotor: (index, value) => {
    if (!get().masterEnable) return;
    const values = [...get().values];
    values[index] = Math.max(MOTOR_STOP, Math.min(MOTOR_TEST_MAX, value));
    set({ values });
    void get().send();
  },

  stopAll: async () => {
    const client = getActiveMspClient();
    const values = stoppedMotors();
    set({ values });
    if (!client) return;
    try {
      await client.request(MSP_SET_MOTOR, encodeSetMotor(values));
    } catch {
      // ignore on disconnect
    }
  },

  refreshTelemetry: async () => {
    const client = getActiveMspClient();
    if (!client) return;
    const frame = await client.requestResponse(MSP_MOTOR, [], 600);
    if (frame) set({ telemetry: parseMotorValues(frame.payload) });
  },

  send: async () => {
    const client = getActiveMspClient();
    if (!client || !get().masterEnable) return;
    if (client.getSnapshot().status?.armed) {
      get().disableMaster();
      set({ error: "ARMED" });
      return;
    }
    set({ busy: true });
    try {
      await client.request(MSP_SET_MOTOR, encodeSetMotor(get().values));
      set({ busy: false });
    } catch (e) {
      set({
        busy: false,
        error: e instanceof Error ? e.message : "MOTOR_SEND_FAILED",
      });
    }
  },
}));
