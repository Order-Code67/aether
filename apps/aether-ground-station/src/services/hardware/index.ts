import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/services/tauri";
import type {
  HostProbeResult,
  NetworkInterfaceInfo,
  SerialPortInfo,
  SerialStatus,
  UsbDeviceInfo,
} from "@/types";

export type ConnectionKind = "ethernet" | "usb" | "wifi" | "uart";

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauriRuntime()) {
    throw new Error("Команда доступна только в desktop (Tauri)");
  }
  return invoke<T>(cmd, args);
}

export async function listSerialPorts(): Promise<SerialPortInfo[]> {
  return call<SerialPortInfo[]>("serial_list_ports");
}

export async function serialOpen(path: string, baudRate: number): Promise<void> {
  await call("serial_open", { path, baudRate });
}

export async function serialClose(): Promise<void> {
  await call("serial_close");
}

export async function serialWrite(data: string): Promise<void> {
  await call("serial_write", { data });
}

export async function serialGetStatus(): Promise<SerialStatus> {
  return call<SerialStatus>("serial_get_status");
}

export async function listUsbDevices(): Promise<UsbDeviceInfo[]> {
  return call<UsbDeviceInfo[]>("list_usb_devices");
}

export async function listNetworkInterfaces(): Promise<NetworkInterfaceInfo[]> {
  return call<NetworkInterfaceInfo[]>("list_network_interfaces");
}

export async function probeHost(
  host: string,
  port: number,
  timeoutMs = 2000,
): Promise<HostProbeResult> {
  return call<HostProbeResult>("probe_host", { host, port, timeoutMs });
}
