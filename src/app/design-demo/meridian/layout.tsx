import Link from "next/link";

const NAV = ["Contacts", "Companies", "Deals", "Policies", "Reports"];

export default function MeridianLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-meridian min-h-screen bg-background text-foreground">
      <header className="bg-sidebar text-sidebar-foreground">
        <div className="flex h-12 items-center gap-6 px-4">
          <Link href="/design-demo/meridian" className="text-sm font-bold tracking-wide">
            YBRYX
          </Link>
          <span className="text-sidebar-foreground/40">|</span>
          <nav className="flex items-center gap-5 text-xs font-medium">
            {NAV.map((item) =>
              item === "Contacts" ? (
                <Link
                  key={item}
                  href="/design-demo/meridian"
                  className="border-b-2 border-sidebar-ring py-3 text-white"
                >
                  {item}
                </Link>
              ) : (
                <span key={item} className="py-3 text-sidebar-foreground/40">
                  {item}
                </span>
              ),
            )}
          </nav>
          <div className="ml-auto">
            <Link
              href="/design-demo"
              className="rounded border border-sidebar-border px-2.5 py-1 text-xs text-sidebar-foreground/80 hover:bg-sidebar-accent"
            >
              ← All demos
            </Link>
          </div>
        </div>
        <div className="border-t border-sidebar-border px-4 py-1.5 text-xs text-sidebar-foreground/60">
          Home &gt; Contacts
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
    </div>
  );
}
