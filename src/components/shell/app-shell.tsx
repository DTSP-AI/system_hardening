"use client";

import { usePathname } from "next/navigation";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { AccountButton } from "@/components/shell/account-button";
import { SoftphoneDock } from "@/components/softphone/softphone-dock";
import { StatusBar } from "@/components/dashboard/status-bar";
import { GlobalSearch } from "@/components/shell/global-search";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideStatusBar = pathname.startsWith("/deals");

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="app-backdrop" />
      <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex h-20 items-center justify-center px-4">
          <span className="font-brand text-3xl tracking-[0.32em] text-sidebar-foreground">
            YBRYX
          </span>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <SidebarNav />
        </div>
        <div className="flex flex-col gap-1 px-3 py-3">
          <AccountButton />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {!hideStatusBar && <StatusBar />}
        <main className="min-w-0 flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <SoftphoneDock />
      <GlobalSearch />
    </div>
  );
}
