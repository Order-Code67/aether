import { useEffect, useState } from "react";
import { create } from "zustand";
import type { DeviceCard } from "@/types";
import { deviceManager } from "@/services/devices/deviceManager";

interface DeviceState {
  devices: DeviceCard[];
  upsert: (device: DeviceCard) => void;
  remove: (id: string) => void;
  clear: () => void;
  setStatus: (
    id: string,
    status: DeviceCard["status"],
    error?: string,
  ) => void;
}

export const useDeviceStore = create<DeviceState>((set) => {
  deviceManager.subscribe((devices) => set({ devices }));
  return {
    devices: deviceManager.list(),
    upsert: (device) => deviceManager.upsert(device),
    remove: (id) => deviceManager.remove(id),
    clear: () => deviceManager.hydrate([]),
    setStatus: (id, status, error) => deviceManager.setStatus(id, status, error),
  };
});

/** Hook that always mirrors Device Manager. */
export function useDevices(): DeviceCard[] {
  const [devices, setDevices] = useState(deviceManager.list());
  useEffect(() => deviceManager.subscribe(setDevices), []);
  return devices;
}
