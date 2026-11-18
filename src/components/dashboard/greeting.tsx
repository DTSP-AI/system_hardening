"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

function greetingForHour(hour: number) {
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

export function Greeting() {
  const { user } = useUser();
  const [hour, setHour] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setHour(new Date().getHours());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  const greeting = hour === null ? "Welcome" : greetingForHour(hour);

  return (
    <span className="text-3xl font-bold tracking-tight text-foreground">
      {greeting}
      {user?.firstName ? `, ${user.firstName}` : ""}
    </span>
  );
}
