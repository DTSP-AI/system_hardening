"use client";

import { useEffect, useRef } from "react";
import { Device, type Call } from "@twilio/voice-sdk";
import { toast } from "sonner";
import { useCallStore } from "@/lib/stores/call-store";
import { useCoachPanelStore } from "@/lib/stores/coach-panel-store";
import { usePhoneControlsStore } from "@/lib/stores/phone-controls-store";

async function fetchToken(): Promise<string> {
  const res = await fetch("/api/twilio/token", { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Could not get a calling token");
  }
  const data = await res.json();
  return data.token as string;
}

export function SoftphoneDock() {
  const { status, current, setStatus, setCallSid, reset } = useCallStore();
  const { open: openCoach, close: closeCoach } = useCoachPanelStore();
  const { register: registerPhoneControls, reset: resetPhoneControls } = usePhoneControlsStore();
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);

  useEffect(() => {
    if (status !== "connecting" || !current) return;
    let cancelled = false;

    (async () => {
      try {
        if (!deviceRef.current) {
          const token = await fetchToken();
          const device = new Device(token, { logLevel: "error" });
          device.on("tokenWillExpire", () => {
            fetchToken()
              .then((t) => device.updateToken(t))
              .catch(() => toast.error("Could not refresh calling session"));
          });
          await device.register();
          deviceRef.current = device;
        }
        if (cancelled) return;

        const call = await deviceRef.current.connect({
          params: {
            To: current.phone,
            contactId: current.contactId ?? "",
            dealId: current.dealId ?? "",
          },
        });
        callRef.current = call;
        registerPhoneControls({
          toggleMute: () => {
            const next = !usePhoneControlsStore.getState().muted;
            callRef.current?.mute(next);
            usePhoneControlsStore.getState().setMuted(next);
          },
          sendDigit: (digit) => {
            callRef.current?.sendDigits(digit);
            usePhoneControlsStore.getState().appendDigit(digit);
          },
          hangup: () => {
            callRef.current?.disconnect();
            reset();
            closeCoach();
          },
        });

        call.on("accept", () => {
          setStatus("active");
          const sid = call.parameters.CallSid;
          if (sid) {
            setCallSid(sid);
            if (current?.wantsCoach) openCoach(sid);
          }
        });
        call.on("disconnect", () => {
          reset();
          closeCoach();
          callRef.current = null;
        });
        call.on("cancel", () => {
          reset();
          closeCoach();
          callRef.current = null;
        });
        call.on("error", (err) => {
          toast.error(err.message ?? "Call failed");
          reset();
          closeCoach();
          callRef.current = null;
        });

        setStatus("ringing");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not place call");
        reset();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, current, setStatus, setCallSid, reset, openCoach, closeCoach, registerPhoneControls]);

  useEffect(() => {
    // Only reset on a true return to idle -- resetting on every non-"active" status
    // (as the old local-state version did) would wipe the handlers registered during
    // "connecting"/"ringing" before the call ever reaches "active".
    if (status === "idle") {
      resetPhoneControls();
      return;
    }
    if (status !== "active") return;
    const interval = setInterval(
      () => usePhoneControlsStore.setState((s) => ({ seconds: s.seconds + 1 })),
      1000,
    );
    return () => clearInterval(interval);
  }, [status, resetPhoneControls]);

  useEffect(() => {
    return () => {
      deviceRef.current?.destroy();
    };
  }, []);

  // Headless: owns the Twilio Device/Call lifecycle and registers the shared
  // phone-controls handlers, but renders nothing -- call UI lives in the
  // header (see HeaderPhoneControls) and the coach panel.
  return null;
}
