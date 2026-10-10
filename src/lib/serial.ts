import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isTauriRuntime } from "@/lib/tauri";

export interface SerialPortInfo {
  path: string;
  name: string;
  portType: string;
}

export interface SerialStatus {
  connected: boolean;
  path: string | null;
  baudRate: number | null;
  error: string | null;
}

export interface SerialDataPayload {
  data: string;
}

export interface SerialBytesPayload {
  bytes: number[];
}

export const BAUD_RATES = [
  9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600,
] as const;

export async function listSerialPorts(): Promise<SerialPortInfo[]> {
  if (!isTauriRuntime()) return [];
  return invoke<SerialPortInfo[]>("serial_list_ports");
}

export async function openSerialPort(
  path: string,
  baudRate: number,
): Promise<SerialStatus> {
  return invoke<SerialStatus>("serial_open", { path, baudRate });
}

export async function closeSerialPort(): Promise<SerialStatus> {
  return invoke<SerialStatus>("serial_close");
}

export async function writeSerial(data: string): Promise<void> {
  return invoke("serial_write", { data });
}

export async function getSerialStatus(): Promise<SerialStatus> {
  if (!isTauriRuntime()) {
    return { connected: false, path: null, baudRate: null, error: null };
  }
  return invoke<SerialStatus>("serial_get_status");
}

export async function listenSerialData(
  handler: (data: string) => void,
): Promise<UnlistenFn> {
  return listen<SerialDataPayload>("serial-data", (event) => {
    handler(event.payload.data);
  });
}

export async function listenSerialBytes(
  handler: (bytes: number[]) => void,
): Promise<UnlistenFn> {
  return listen<SerialBytesPayload>("serial-bytes", (event) => {
    handler(event.payload.bytes);
  });
}

export async function listenSerialStatus(
  handler: (status: SerialStatus) => void,
): Promise<UnlistenFn> {
  return listen<SerialStatus>("serial-status", (event) => {
    handler(event.payload);
  });
}
