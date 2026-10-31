import { create } from "zustand";
import type { DeviceCard } from "@/types";

interface DeviceState {
  devices: DeviceCard[];
  upsert: (device: DeviceCard) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useDeviceStore = create<DeviceState>((set) => ({
  devices: [],
  upsert: (device) =>
    set((s) => {
      const idx = s.devices.findIndex((d) => d.id === device.id);
      if (idx < 0) return { devices: [...s.devices, device] };
      const next = [...s.devices];
      next[idx] = device;
      return { devices: next };
    }),
  remove: (id) => set((s) => ({ devices: s.devices.filter((d) => d.id !== id) })),
  clear: () => set({ devices: [] }),
}));
