"use client";

import { useState } from "react";
import { Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCallStore } from "@/lib/stores/call-store";

export function PhoneWidget() {
  const [phone, setPhone] = useState("");
  const requestCall = useCallStore((s) => s.requestCall);
  const status = useCallStore((s) => s.status);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!phone.trim() || status !== "idle") return;
        requestCall({ phone: phone.trim() });
        setPhone("");
      }}
    >
      <Input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Enter a phone number…"
        inputMode="tel"
        className="text-sm"
      />
      <Button type="submit" size="sm" disabled={!phone.trim() || status !== "idle"}>
        <Phone className="size-3.5" /> Call
      </Button>
    </form>
  );
}
