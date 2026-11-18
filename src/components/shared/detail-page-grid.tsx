"use client";

import type { ReactNode } from "react";
import { CoachPanel } from "@/components/coach/coach-panel";
import { useCoachPanelStore } from "@/lib/stores/coach-panel-store";

/** Shared shell for the two-column detail-page layout (record summary + activity),
 * used identically across all 8 detail-page routes. Cancels the parent <main>'s p-6
 * via -m-6 so the columns sit flush against the sidebar/top/edges as sections rather
 * than floating cards, and adds a third column -- sized to match the summary column --
 * for the AI coach panel when a coached call is active, so it sits to the right of the
 * activity column instead of overlaying/spanning the page. */
export function DetailPageGrid({ left, right }: { left: ReactNode; right: ReactNode }) {
  const { isOpen, callSid, close } = useCoachPanelStore();
  const showCoach = isOpen && !!callSid;

  return (
    <div
      className={`-m-6 grid h-full grid-cols-1 ${
        showCoach ? "lg:grid-cols-[25%_minmax(0,1fr)_25%]" : "lg:grid-cols-[25%_minmax(0,1fr)]"
      }`}
    >
      <div className="overflow-y-auto border-border bg-card p-6 lg:border-r">{left}</div>
      <div className={`overflow-y-auto bg-card p-6 ${showCoach ? "lg:border-r lg:border-border" : ""}`}>
        {right}
      </div>
      {showCoach && (
        <div className="overflow-y-auto bg-card p-6">
          <CoachPanel callSid={callSid!} onClose={close} />
        </div>
      )}
    </div>
  );
}
