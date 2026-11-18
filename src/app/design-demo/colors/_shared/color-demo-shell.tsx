import Link from "next/link";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { AccountButton } from "@/components/shell/account-button";
import { OrgSwitcher } from "@/components/shell/org-switcher";

export function ColorDemoShell({
  themeClass,
  children,
}: {
  themeClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`${themeClass} flex h-screen overflow-hidden bg-background text-foreground`}>
      <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex h-20 items-center justify-center px-4">
          <span className="text-2xl font-bold tracking-[0.2em] text-sidebar-foreground">
            YBRYX
          </span>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <SidebarNav />
        </div>
        <div className="flex flex-col gap-1 px-3 py-3">
          <AccountButton />
          <OrgSwitcher />
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">
        <Link href="/design-demo/colors" className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground">
          ← All color demos
        </Link>
        {children}
      </main>
    </div>
  );
}
