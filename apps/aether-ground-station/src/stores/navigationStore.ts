import { create } from "zustand";
import type { ModuleId } from "@/types";

interface NavigationState {
  activeModule: ModuleId;
  setActiveModule: (id: ModuleId) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  activeModule: "workspace",
  setActiveModule: (id) => set({ activeModule: id }),
}));
