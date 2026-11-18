"use client";

import { use } from "react";
import { ContactDetail } from "../../_shared/contact-detail";

export default function DaylightContactDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ContactDetail id={id} />;
}
