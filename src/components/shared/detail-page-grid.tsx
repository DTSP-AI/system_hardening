"use client";

import type { ReactNode } from "react";

/** Shared shell for the two-column detail-page layout (record summary + activity),
 * used identically across all 8 detail-page routes. Cancels the parent <main>'s p-6
 * via -m-6 so the columns sit flush against the sidebar/top/edges as sections rather
 * than floating cards. */
export function DetailPageGrid({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="-m-6 grid h-full grid-cols-1 lg:grid-cols-[25%_minmax(0,1fr)]">
      <div className="overflow-y-auto border-border bg-card p-6 lg:border-r">{left}</div>
      <div className="overflow-y-auto bg-card p-6">{right}</div>
    </div>
  );
}
