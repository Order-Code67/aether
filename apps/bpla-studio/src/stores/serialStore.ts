import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  BAUD_RATES,
  closeSerialPort,
  getSerialStatus,
  listSerialPorts,
  openSerialPort,
  writeSerial,
  writeSerialBytes,
  type SerialPortInfo,
  type SerialStatus,
} from "@/lib/serial";
import { isTauriRuntime } from "@/lib/tauri";

const MAX_LINES = 2000;

interface SerialState {
  ports: SerialPortInfo[];
  selectedPath: string;
  baudRate: number;
  connected: boolean;
  connecting: boolean;
  lines: string[];
  autoScroll: boolean;
  error: string | null;
  refreshPorts: () => Promise<void>;
  setSelectedPath: (path: string) => void;
  setBaudRate: (baud: number) => void;
  setAutoScroll: (value: boolean) => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  send: (text: string, appendNewline?: boolean) => Promise<void>;
  /** Binary write for MSP / MAVLink frames. */
  sendBytes: (bytes: number[] | Uint8Array) => Promise<void>;
  appendLine: (line: string) => void;
  clearLines: () => void;
  applyStatus: (status: SerialStatus) => void;
  hydrateStatus: () => Promise<void>;
}

export const useSerialStore = create<SerialState>()(
  persist(
    (set, get) => ({
      ports: [],
      selectedPath: "",
      baudRate: 115200,
      connected: false,
      connecting: false,
      lines: [],
      autoScroll: true,
      error: null,

      refreshPorts: async () => {
        if (!isTauriRuntime()) {
          set({
            error:
              "Serial Monitor requires the desktop app (npm run tauri:dev).",
          });
          return;
        }

        try {
          const ports = await listSerialPorts();
          set((state) => {
            const stillSelected = ports.some(
              (port) => port.path === state.selectedPath,
            );
            return {
              ports,
              selectedPath: stillSelected
                ? state.selectedPath
                : (ports[0]?.path ?? ""),
              error: null,
            };
          });
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : "Failed to list serial ports.",
          });
        }
      },

      setSelectedPath: (path) => set({ selectedPath: path }),

      setBaudRate: (baud) => {
        if ((BAUD_RATES as readonly number[]).includes(baud)) {
          set({ baudRate: baud });
        }
      },

      setAutoScroll: (value) => set({ autoScroll: value }),

      connect: async () => {
        const { selectedPath, baudRate, connected } = get();
        if (!selectedPath) {
          set({ error: "Select a serial port first." });
          return;
        }
        if (connected) return;

        set({ connecting: true, error: null });
        try {
          const status = await openSerialPort(selectedPath, baudRate);
          get().applyStatus(status);
          set({ connecting: false });
        } catch (error) {
          set({
            connecting: false,
            connected: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to open serial port.",
          });
        }
      },

      disconnect: async () => {
        try {
          const status = await closeSerialPort();
          get().applyStatus(status);
        } catch (error) {
          set({
            connected: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to close serial port.",
          });
        }
      },

      send: async (text, appendNewline = true) => {
        if (!get().connected) {
          set({ error: "Not connected to a serial port." });
          return;
        }
        const payload = appendNewline && !text.endsWith("\n") ? `${text}\n` : text;
        try {
          await writeSerial(payload);
          set({ error: null });
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : "Failed to write to serial port.",
          });
        }
      },

      sendBytes: async (bytes) => {
        if (!get().connected) {
          set({ error: "Not connected to a serial port." });
          return;
        }
        try {
          await writeSerialBytes(bytes);
          set({ error: null });
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : "Failed to write to serial port.",
          });
        }
      },

      appendLine: (line) =>
        set((state) => {
          const next = [...state.lines, line];
          if (next.length > MAX_LINES) {
            return { lines: next.slice(next.length - MAX_LINES) };
          }
          return { lines: next };
        }),

      clearLines: () => set({ lines: [] }),

      applyStatus: (status) =>
        set({
          connected: status.connected,
          selectedPath: status.path ?? get().selectedPath,
          baudRate: status.baudRate ?? get().baudRate,
          error: status.error,
          connecting: false,
        }),

      hydrateStatus: async () => {
        if (!isTauriRuntime()) return;
        try {
          const status = await getSerialStatus();
          get().applyStatus(status);
        } catch {
          // ignore
        }
      },
    }),
    {
      name: "aether-serial",
      partialize: (state) => ({
        selectedPath: state.selectedPath,
        baudRate: state.baudRate,
        autoScroll: state.autoScroll,
      }),
    },
  ),
);
