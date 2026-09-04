import { create } from "zustand";
import { Vertical } from "@/data/verticals";

interface AppState {
  vertical: Vertical;
  setVertical: (v: Vertical) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Default to OT Security — the vertical with full data across all three modes
  // (including a live COA namespace), so every mode answers correctly out of the box.
  vertical: "otsec",
  setVertical: (vertical) => set({ vertical }),
}));
