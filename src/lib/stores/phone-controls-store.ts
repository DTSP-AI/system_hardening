import { create } from "zustand";

interface PhoneControlsStore {
  muted: boolean;
  dialpadOpen: boolean;
  digitsSent: string;
  seconds: number;
  toggleMute: (() => void) | null;
  sendDigit: ((digit: string) => void) | null;
  hangup: (() => void) | null;
  toggleDialpad: () => void;
  setMuted: (muted: boolean) => void;
  appendDigit: (digit: string) => void;
  register: (handlers: {
    toggleMute: () => void;
    sendDigit: (digit: string) => void;
    hangup: () => void;
  }) => void;
  reset: () => void;
}

/** Shared imperative call controls, registered by SoftphoneDock (the only place
 * holding the live Twilio Call ref) so both the floating dock and the docked
 * CoachPanel can render mute/dialpad/hangup for the same active call --
 * mirrors the useCallStore/useCoachPanelStore cross-component UI-state precedent. */
export const usePhoneControlsStore = create<PhoneControlsStore>((set) => ({
  muted: false,
  dialpadOpen: false,
  digitsSent: "",
  seconds: 0,
  toggleMute: null,
  sendDigit: null,
  hangup: null,
  toggleDialpad: () => set((s) => ({ dialpadOpen: !s.dialpadOpen })),
  setMuted: (muted) => set({ muted }),
  appendDigit: (digit) => set((s) => ({ digitsSent: s.digitsSent + digit })),
  register: (handlers) => set(handlers),
  reset: () =>
    set({
      muted: false,
      dialpadOpen: false,
      digitsSent: "",
      seconds: 0,
      toggleMute: null,
      sendDigit: null,
      hangup: null,
    }),
}));
