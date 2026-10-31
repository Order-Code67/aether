import { create } from "zustand";
import type { AppEvent } from "@/types";

const MAX = 1000;

interface EventLogState {
  events: AppEvent[];
  append: (event: AppEvent) => void;
  clear: () => void;
}

export const useEventLogStore = create<EventLogState>((set) => ({
  events: [],
  append: (event) =>
    set((s) => ({ events: [event, ...s.events].slice(0, MAX) })),
  clear: () => set({ events: [] }),
}));
