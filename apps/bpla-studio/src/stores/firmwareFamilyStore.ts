import { create } from "zustand";
import { persist } from "zustand/middleware";

export type FirmwareFamily = "inav" | "betaflight" | "ardupilot";

interface FirmwareFamilyState {
  family: FirmwareFamily;
  selectedBoardId: string | null;
  setFamily: (family: FirmwareFamily) => void;
  setSelectedBoardId: (id: string | null) => void;
}

export const useFirmwareFamilyStore = create<FirmwareFamilyState>()(
  persist(
    (set) => ({
      family: "inav",
      selectedBoardId: null,
      setFamily: (family) => set({ family, selectedBoardId: null }),
      setSelectedBoardId: (selectedBoardId) => set({ selectedBoardId }),
    }),
    { name: "bpla-studio-firmware-family" },
  ),
);
