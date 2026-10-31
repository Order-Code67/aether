export type DeviceStatus =
  | "Online"
  | "Offline"
  | "Connecting"
  | "Warning"
  | "Error"
  | "Unknown";

export type ConnectionType = "ethernet" | "usb" | "wifi" | "uart" | "capture";

export interface DeviceCard {
  id: string;
  name: string;
  manufacturer?: string;
  model?: string;
  connectionType: ConnectionType;
  address?: string;
  status: DeviceStatus;
  lastSeenAt?: string;
  firmwareVersion?: string;
  capabilities: string[];
}
