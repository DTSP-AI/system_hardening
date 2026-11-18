"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export function AccountButton() {
  const { openUserProfile } = useClerk();
  const { user } = useUser();

  return (
    <button
      type="button"
      onClick={() => openUserProfile()}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
    >
      <Avatar size="sm">
        <AvatarImage src={user?.imageUrl} alt={user?.fullName ?? "Account"} />
        <AvatarFallback>{user?.firstName?.[0] ?? "U"}</AvatarFallback>
      </Avatar>
      {user?.fullName ?? "Manage account"}
    </button>
  );
}
