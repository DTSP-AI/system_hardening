"use client";

import { Greeting } from "@/components/dashboard/greeting";
import { HeaderPhoneControls } from "@/components/dashboard/header-phone-controls";
import { useCallStore } from "@/lib/stores/call-store";

export function HeaderCenter() {
  const status = useCallStore((s) => s.status);
  return status === "idle" ? <Greeting /> : <HeaderPhoneControls />;
}
