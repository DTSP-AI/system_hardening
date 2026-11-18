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
    setHour(new Date().getHours());
    const id = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => clearInterval(id);
  }, []);

  const greeting = hour === null ? "Welcome" : greetingForHour(hour);

  return (
    <span className="font-brand text-xl tracking-tight text-foreground">
      {greeting}
      {user?.firstName ? `, ${user.firstName}` : ""}
    </span>
  );
}
