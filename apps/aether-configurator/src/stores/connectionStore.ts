import { create } from "zustand";
import type { TransportKind } from "@/core/protocols/transport/types";
import {
  SerialTransport,
  TcpTransport,
  UdpTransport,
} from "@/core/protocols/transport/electronTransport";
import { MspClient } from "@/core/protocols/msp/client";
import type { MspStatusSnapshot } from "@/core/protocols/msp/codec";
import { emptySnapshot } from "@/core/protocols/msp/codec";
import type { SerialPortInfo } from "@/types/bridge";

export type ConnectionMode = "serial" | "tcp" | "udp";
export type ProtocolMode = "msp" | "mavlink" | "auto";

const BAUD_RATES = [
  9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600,
] as const;

interface ConnectionState {
  mode: ConnectionMode;
  protocol: ProtocolMode;
  ports: SerialPortInfo[];
  selectedPort: string;
  baudRate: number;
  host: string;
  netPort: number;
  connected: boolean;
  connecting: boolean;
  label: string | null;
  error: string | null;
  transportKind: TransportKind | null;
  snapshot: MspStatusSnapshot;
  polling: boolean;
  lastPollError: string | null;

  setMode: (mode: ConnectionMode) => void;
  setProtocol: (protocol: ProtocolMode) => void;
  setSelectedPort: (port: string) => void;
  setBaudRate: (baud: number) => void;
  setHost: (host: string) => void;
  setNetPort: (port: number) => void;
  refreshPorts: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  pollStatus: () => Promise<void>;
  startAutoPoll: (intervalMs?: number) => void;
  stopAutoPoll: () => void;
}

let transport: SerialTransport | TcpTransport | UdpTransport | null = null;
let msp: MspClient | null = null;
let autoPollTimer: ReturnType<typeof setInterval> | null = null;

export const BAUD_RATE_OPTIONS = BAUD_RATES;

/** Active MSP client for feature tabs (Setup, Modes, …). Null when disconnected. */
export function getActiveMspClient(): MspClient | null {
  return msp;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  mode: "serial",
  protocol: "msp",
  ports: [],
  selectedPort: "",
  baudRate: 115200,
  host: "127.0.0.1",
  netPort: 5760,
  connected: false,
  connecting: false,
  label: null,
  error: null,
  transportKind: null,
  snapshot: emptySnapshot(),
  polling: false,
  lastPollError: null,

  setMode: (mode) => set({ mode }),
  setProtocol: (protocol) => set({ protocol }),
  setSelectedPort: (selectedPort) => set({ selectedPort }),
  setBaudRate: (baudRate) => set({ baudRate }),
  setHost: (host) => set({ host }),
  setNetPort: (netPort) => set({ netPort }),

  refreshPorts: async () => {
    if (!window.aether) {
      set({ ports: [], error: "NO_ELECTRON_BRIDGE" });
      return;
    }
    try {
      const ports = await window.aether.serial.list();
      const prev = get().selectedPort.trim().toUpperCase();
      const stillThere = ports.some((p) => p.path.toUpperCase() === prev);
      set({
        ports,
        // Keep manual COM typed by the user even if not in the live list yet.
        selectedPort: stillThere
          ? ports.find((p) => p.path.toUpperCase() === prev)!.path
          : prev || ports[0]?.path || "",
        error: null,
      });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "LIST_PORTS_FAILED",
      });
    }
  },

  connect: async () => {
    const state = get();
    if (state.connecting || state.connected) return;
    set({ connecting: true, error: null });

    try {
      await get().disconnect();

      if (state.mode === "serial") {
        const t = new SerialTransport();
        await t.connect({ path: state.selectedPort, baudRate: state.baudRate });
        transport = t;
      } else if (state.mode === "tcp") {
        const t = new TcpTransport();
        await t.connect({ host: state.host, port: state.netPort });
        transport = t;
      } else {
        const t = new UdpTransport();
        await t.connect({ host: state.host, port: state.netPort });
        transport = t;
      }

      msp = new MspClient(transport);
      msp.startLive();
      msp.onSnapshot((snapshot) => set({ snapshot }));

      const st = transport.getStatus();
      set({
        connected: true,
        connecting: false,
        label: st.label,
        transportKind: st.kind,
        error: null,
      });

      // Immediate identity poll for MSP-oriented connections.
      if (state.protocol !== "mavlink") {
        void get().pollStatus();
        get().startAutoPoll(2000);
      } else {
        // MAVLink: probe HEARTBEAT asynchronously (TCP/UDP/SITL).
        const { createMavlinkAdapter } = await import(
          "@/core/protocols/mavlink/stub"
        );
        const adapter = createMavlinkAdapter(transport);
        void adapter.probe().then((result) => {
          if (result.ok && result.detail) {
            set({ label: `${st.label ?? "mavlink"} · ${result.detail}` });
          } else if (result.detail) {
            set({ lastPollError: result.detail });
          }
        });
      }
    } catch (e) {
      transport = null;
      msp = null;
      set({
        connected: false,
        connecting: false,
        error: e instanceof Error ? e.message : "CONNECT_FAILED",
      });
    }
  },

  disconnect: async () => {
    get().stopAutoPoll();
    msp?.dispose();
    msp = null;
    if (transport) {
      try {
        await transport.disconnect();
      } catch {
        // ignore
      }
    }
    transport = null;
    set({
      connected: false,
      connecting: false,
      label: null,
      transportKind: null,
      snapshot: emptySnapshot(),
    });
  },

  pollStatus: async () => {
    if (!msp || !get().connected) return;
    set({ polling: true });
    const result = await msp.pollStatus();
    set({
      polling: false,
      snapshot: result.snapshot,
      lastPollError: result.ok ? null : result.error,
    });
  },

  startAutoPoll: (intervalMs = 2000) => {
    get().stopAutoPoll();
    autoPollTimer = setInterval(() => {
      if (get().connected && !get().polling) void get().pollStatus();
    }, intervalMs);
  },

  stopAutoPoll: () => {
    if (autoPollTimer) {
      clearInterval(autoPollTimer);
      autoPollTimer = null;
    }
  },
}));
