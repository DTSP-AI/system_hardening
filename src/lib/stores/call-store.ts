import { create } from "zustand";

export type CallStatus = "idle" | "connecting" | "ringing" | "active" | "error";

export interface PendingCall {
  phone: string;
  contactId?: string;
  dealId?: string;
  displayName?: string;
  // Only known once Twilio's "accept" event fires (call.parameters.CallSid) --
  // not available at requestCall time, so this starts unset even while active.
  callSid?: string;
  // Set by the "CC" button -- once callSid becomes known on "accept", the
  // softphone dock auto-opens the inline coach panel instead of requiring a
  // second manual click.
  wantsCoach?: boolean;
}

interface CallStore {
  status: CallStatus;
  current: PendingCall | null;
  error: string | null;
  requestCall: (call: PendingCall) => void;
  setStatus: (status: CallStatus, error?: string) => void;
  setCallSid: (callSid: string) => void;
  reset: () => void;
}

export const useCallStore = create<CallStore>((set) => ({
  status: "idle",
  current: null,
  error: null,
  requestCall: (call) => set({ current: call, status: "connecting", error: null }),
  setStatus: (status, error) => set({ status, error: error ?? null }),
  setCallSid: (callSid) =>
    set((state) => ({ current: state.current ? { ...state.current, callSid } : state.current })),
  reset: () => set({ status: "idle", current: null, error: null }),
}));
