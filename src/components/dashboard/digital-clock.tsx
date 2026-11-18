"use client";

import { useEffect, useState } from "react";

export function DigitalClock({ align = "left" }: { align?: "left" | "right" }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const alignClass = align === "right" ? "items-end text-right" : "items-start text-left";

  if (!now) {
    return (
      <div className={`flex flex-col gap-1 ${alignClass}`}>
        <span className="font-brand text-3xl text-foreground">--:--:--</span>
      </div>
    );
  }

  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const date = now.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className={`flex flex-col gap-1 ${alignClass}`}>
      <span className="font-brand text-3xl tracking-tight text-foreground tabular-nums">
        {time}
      </span>
      <span className="text-sm text-muted-foreground">{date}</span>
    </div>
  );
}
