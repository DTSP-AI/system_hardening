import { create } from "zustand";

interface CoachPanelStore {
  isOpen: boolean;
  callSid: string | null;
  open: (callSid: string) => void;
  close: () => void;
}

/** Coordinates the inline AI-coach panel docked in the app shell (src/app/(app)/layout.tsx)
 * across the softphone dock (which triggers it) and the detail pages that render it --
 * mirrors the useCallStore/useSearchStore precedent for cross-component UI-only state. */
export const useCoachPanelStore = create<CoachPanelStore>((set) => ({
  isOpen: false,
  callSid: null,
  open: (callSid) => set({ isOpen: true, callSid }),
  close: () => set({ isOpen: false, callSid: null }),
}));
