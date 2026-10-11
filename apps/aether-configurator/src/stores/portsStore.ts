import { create } from "zustand";
import { MSP_CF_SERIAL_CONFIG } from "@/core/protocols/msp/commands";
import {
  formatCliSerialLine,
  parseCfSerialConfig,
  parseCliSerialLines,
  toggleFunctionBit,
  type MspSerialPort,
} from "@/core/protocols/msp/ports";
import { getActiveMspClient } from "@/stores/connectionStore";

interface PortsState {
  ports: MspSerialPort[];
  source: "msp" | "cli" | "none";
  busy: boolean;
  dirty: boolean;
  notice: string | null;
  error: string | null;
  load: () => Promise<void>;
  write: () => Promise<void>;
  toggleBit: (portIndex: number, bit: number, on: boolean) => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export const usePortsStore = create<PortsState>((set, get) => ({
  ports: [],
  source: "none",
  busy: false,
  dirty: false,
  notice: null,
  error: null,

  load: async () => {
    const client = getActiveMspClient();
    if (!client) {
      set({ error: "NOT_CONNECTED" });
      return;
    }
    set({ busy: true, error: null, notice: null });
    try {
      const frame = await client.requestResponse(MSP_CF_SERIAL_CONFIG, [], 1000);
      const mspPorts = frame ? parseCfSerialConfig(frame.payload) : null;
      if (mspPorts && mspPorts.length > 0) {
        set({
          ports: mspPorts,
          source: "msp",
          busy: false,
          dirty: false,
          notice: "PORTS_LOADED_MSP",
        });
        return;
      }

      const chunks: string[] = [];
      const off = window.aether?.serial.onData((d) => {
        chunks.push(d);
      });
      await window.aether?.serial.write("#\n");
      await sleep(80);
      await window.aether?.serial.write("serial\n");
      await sleep(900);
      await window.aether?.serial.write("exit\n");
      await sleep(200);
      off?.();
      const ports = parseCliSerialLines(chunks.join(""));
      if (ports.length === 0) {
        set({
          busy: false,
          source: "none",
          error: "PORTS_NO_DATA",
          ports: [],
        });
        return;
      }
      set({
        ports,
        source: "cli",
        busy: false,
        dirty: false,
        notice: "PORTS_LOADED_CLI",
      });
    } catch (e) {
      set({
        busy: false,
        error: e instanceof Error ? e.message : "PORTS_LOAD_FAILED",
      });
    }
  },

  write: async () => {
    const client = getActiveMspClient();
    const { ports } = get();
    if (!client || ports.length === 0) {
      set({ error: "NOT_CONNECTED" });
      return;
    }
    if (client.getSnapshot().status?.armed) {
      set({ error: "ARMED" });
      return;
    }
    set({ busy: true, error: null });
    try {
      await window.aether?.serial.write("#\n");
      await sleep(60);
      for (const p of ports) {
        await window.aether?.serial.write(`${formatCliSerialLine(p)}\n`);
        await sleep(50);
      }
      await window.aether?.serial.write("exit\n");
      set({ busy: false, dirty: false, notice: "PORTS_WRITTEN" });
    } catch (e) {
      set({
        busy: false,
        error: e instanceof Error ? e.message : "PORTS_WRITE_FAILED",
      });
    }
  },

  toggleBit: (portIndex, bit, on) => {
    set((s) => ({
      ports: s.ports.map((p, i) =>
        i === portIndex
          ? { ...p, functionMask: toggleFunctionBit(p.functionMask, bit, on) }
          : p,
      ),
      dirty: true,
    }));
  },
}));
