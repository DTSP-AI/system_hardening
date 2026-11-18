import Link from "next/link";

const NAV = ["Contacts", "Companies", "Deals", "Tasks", "Reports"];

export default function BeaconLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-beacon min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <Link href="/design-demo/beacon" className="text-lg font-bold text-primary">
              YBRYX
            </Link>
            <nav className="flex items-center gap-6 text-sm font-medium">
              {NAV.map((item) =>
                item === "Contacts" ? (
                  <Link key={item} href="/design-demo/beacon" className="text-foreground">
                    {item}
                  </Link>
                ) : (
                  <span key={item} className="cursor-default text-muted-foreground/50">
                    {item}
                  </span>
                ),
              )}
            </nav>
          </div>
          <Link
            href="/design-demo"
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary"
          >
            ← All demos
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
