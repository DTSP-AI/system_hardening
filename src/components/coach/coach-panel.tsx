"use client";

import { useEffect, useRef, useState } from "react";
import { X, PhoneOff, Mic, MicOff, Grid3x3 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCallStore } from "@/lib/stores/call-store";
import { usePhoneControlsStore } from "@/lib/stores/phone-controls-store";

interface TranscriptLine {
  speaker: "rep" | "caller";
  text: string;
  ts: number;
}

interface Tip {
  text: string;
  ts: number;
}

interface InterimLine {
  speaker: "rep" | "caller";
  text: string;
}

const MAX_RECONNECT_DELAY_MS = 15_000;

export function CoachPanel({ callSid, onClose }: { callSid: string; onClose: () => void }) {
  const startSession = trpc.coaching.startSession.useMutation();
  const { status: callStatus } = useCallStore();
  const {
    muted,
    dialpadOpen,
    digitsSent,
    seconds,
    toggleMute,
    sendDigit,
    hangup: hangupCall,
    toggleDialpad,
  } = usePhoneControlsStore();
  // Only one call can be active at a time in this softphone (single Twilio Device),
  // so gating on callSid equality just risks a stale-closure mismatch for no benefit --
  // any active call is necessarily the one this docked panel is showing.
  const isThisCallActive = callStatus === "active";
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [tips, setTips] = useState<Tip[]>([]);
  const [interimLine, setInterimLine] = useState<InterimLine | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(1000);
  const closedByUsRef = useRef(false);

  const [prevCallSid, setPrevCallSid] = useState(callSid);
  if (prevCallSid !== callSid) {
    setPrevCallSid(callSid);
    setTranscript([]);
    setTips([]);
    setInterimLine(null);
  }

  useEffect(() => {
    closedByUsRef.current = false;

    let cancelled = false;

    async function connect() {
      const { token, relayWsUrl } = await startSession.mutateAsync({ callSid });
      if (cancelled) return;

      const ws = new WebSocket(`${relayWsUrl}/coach-feed?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        reconnectDelayRef.current = 1000;
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "snapshot") {
            // Sent once, right after connecting -- carries whatever transcript/tips
            // already accumulated before this socket joined (e.g. the opening tip,
            // which fires the instant the Twilio stream starts, often before the
            // rep has opened the panel at all).
            setTranscript(msg.transcript ?? []);
            setTips(msg.tips ?? []);
          } else if (msg.type === "transcript") {
            setInterimLine(null);
            setTranscript((prev) => [...prev, msg.line as TranscriptLine]);
          } else if (msg.type === "tip") {
            setTips((prev) => [...prev, msg.tip as Tip]);
          } else if (msg.type === "interim") {
            setInterimLine({ speaker: msg.speaker, text: msg.text });
          }
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        setConnected(false);
        setInterimLine(null);
        wsRef.current = null;
        if (closedByUsRef.current || cancelled) return;
        const delay = reconnectDelayRef.current;
        reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY_MS);
        setTimeout(() => {
          if (!cancelled) connect();
        }, delay);
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      cancelled = true;
      closedByUsRef.current = true;
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callSid]);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-medium">AI Call Coach</h1>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={
              connected
                ? "gap-1.5 border-(--good)/30 bg-(--good)/10 text-(--good)"
                : "gap-1.5 border-(--warn)/30 bg-(--warn)/10 text-(--warn)"
            }
          >
            <span
              className={`size-1.5 rounded-full ${connected ? "animate-pulse bg-(--good)" : "bg-(--warn)"}`}
            />
            {connected ? "Live" : "Reconnecting…"}
          </Badge>
          <Button variant="ghost" size="icon-sm" title="Close" onClick={onClose}>
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-[2] flex-col gap-2 overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Say this next
        </div>
        <div className="flex flex-1 flex-col-reverse gap-2 overflow-y-auto p-3">
          <div className="flex flex-col gap-2">
            {tips.length === 0 && (
              <span className="text-xs text-muted-foreground">Listening…</span>
            )}
            {tips.map((tip, i) => (
              <div
                key={i}
                className="rounded-md border border-accent-foreground/40 bg-accent px-4 py-3 text-sm font-semibold leading-snug"
              >
                {tip.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Live transcript
        </div>
        <div className="flex-1 overflow-y-auto p-3 text-sm">
          {transcript.length === 0 && (
            <span className="text-xs text-muted-foreground">Waiting for audio…</span>
          )}
          {transcript.map((line, i) => (
            <p key={i} className="mb-1">
              <span className="font-medium text-muted-foreground">
                {line.speaker === "rep" ? "You: " : "Caller: "}
              </span>
              {line.text}
            </p>
          ))}
          {interimLine && (
            <p className="mb-1 text-muted-foreground/70 italic">
              <span className="font-medium">
                {interimLine.speaker === "rep" ? "You: " : "Caller: "}
              </span>
              {interimLine.text}
            </p>
          )}
        </div>
      </div>

      {isThisCallActive && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <span className="mono-num flex-1 text-sm text-muted-foreground">
              {mm}:{ss}
            </span>
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
            <Button variant="destructive" size="icon-sm" onClick={() => hangupCall?.()}>
              <PhoneOff className="size-3.5" />
            </Button>
          </div>
          {dialpadOpen && (
            <div className="flex flex-col gap-2 border-t border-border pt-2">
              <div className="mono-num min-h-5 text-center text-sm tracking-widest text-card-foreground">
                {digitsSent || <span className="text-muted-foreground">Enter extension…</span>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((digit) => (
                  <Button
                    key={digit}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => sendDigit?.(digit)}
                  >
                    {digit}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
