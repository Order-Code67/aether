export interface SerialPortInfo {
  path: string;
  name: string;
  portType: string;
}

export interface SerialStatus {
  connected: boolean;
  path?: string;
  baudRate?: number;
  error?: string;
}

export interface UsbDeviceInfo {
  id: string;
  vendorId: number;
  productId: number;
  manufacturer?: string;
  product?: string;
  serialNumber?: string;
}

export interface NetworkInterfaceInfo {
  name: string;
  ipv4?: string;
  mac?: string;
}

export interface HostProbeResult {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}
