"use client";

import { OrganizationSwitcher } from "@clerk/nextjs";

const clerkAppearance = {
  elements: {
    rootBox: "flex w-full items-center",
    organizationSwitcherTrigger:
      "w-full justify-between text-sm text-foreground bg-transparent hover:bg-sidebar-accent/60 rounded-md px-2 py-1.5",
    organizationSwitcherPopoverCard: "shadow-lg border border-border",
  },
};

export function OrgSwitcher() {
  return (
    <OrganizationSwitcher
      hidePersonal
      appearance={clerkAppearance}
      afterSelectOrganizationUrl="/"
    />
  );
}
