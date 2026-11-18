"use client";

import { Mic, MicOff, Grid3x3, Sparkles, PhoneOff, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCallStore } from "@/lib/stores/call-store";
import { usePhoneControlsStore } from "@/lib/stores/phone-controls-store";
import { useCoachPanelStore } from "@/lib/stores/coach-panel-store";

const DIALPAD_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

export function HeaderPhoneControls() {
  const { status, current, error } = useCallStore();
  const { isOpen: coachOpen, callSid: coachCallSid, open: openCoach, close: closeCoach } =
    useCoachPanelStore();
  const { muted, dialpadOpen, digitsSent, seconds, toggleMute, sendDigit, hangup, toggleDialpad } =
    usePhoneControlsStore();

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-center gap-2">
        <span className="relative flex size-4 shrink-0 items-center justify-center">
          <PhoneCall className="size-4 text-accent-foreground" />
          {status === "active" && (
            <span className="absolute -top-0.5 -right-0.5 size-1.5 animate-pulse rounded-full bg-(--good)" />
          )}
        </span>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="max-w-40 truncate text-sm font-medium text-foreground">
            {current?.displayName ?? current?.phone ?? "Call"}
          </span>
          <span className={`text-xs text-muted-foreground ${status === "active" ? "mono-num" : ""}`}>
            {status === "connecting" && "Connecting…"}
            {status === "ringing" && "Ringing…"}
            {status === "active" && `${mm}:${ss}`}
            {status === "error" && (error ?? "Call failed")}
          </span>
        </div>
        {status === "active" && (
          <>
            <Button variant="outline" size="icon-sm" onClick={() => toggleMute?.()}>
              {muted ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
            </Button>
            <Button
              variant={dialpadOpen ? "secondary" : "outline"}
              size="icon-sm"
              onClick={toggleDialpad}
            >
              <Grid3x3 className="size-3.5" />
            </Button>
            {current?.callSid && (
              <Button
                variant={coachOpen && coachCallSid === current.callSid ? "default" : "outline"}
                size="icon-sm"
                title="AI Coach"
                onClick={() =>
                  coachOpen && coachCallSid === current.callSid
                    ? closeCoach()
                    : openCoach(current.callSid!)
                }
              >
                <Sparkles className="size-3.5" />
              </Button>
            )}
          </>
        )}
        <Button variant="destructive" size="icon-sm" onClick={() => hangup?.()}>
          <PhoneOff className="size-3.5" />
        </Button>
      </div>
      {status === "active" && dialpadOpen && (
        <div className="flex flex-col items-center gap-1">
          <span className="mono-num text-xs tracking-widest text-muted-foreground">
            {digitsSent || "Enter extension…"}
          </span>
          <div className="grid grid-cols-6 gap-1">
            {DIALPAD_DIGITS.map((digit) => (
              <Button
                key={digit}
                type="button"
                variant="outline"
                size="icon-xs"
                onClick={() => sendDigit?.(digit)}
              >
                {digit}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
