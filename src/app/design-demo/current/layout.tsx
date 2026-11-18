import Link from "next/link";
import { Users, Building2, Handshake, ListChecks, ArrowLeft } from "lucide-react";

const NAV = [
  { icon: Users, label: "Contacts", active: true },
  { icon: Building2, label: "Companies", active: false },
  { icon: Handshake, label: "Deals", active: false },
  { icon: ListChecks, label: "Tasks", active: false },
];

export default function CurrentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-current flex min-h-screen bg-background text-foreground">
      <aside className="flex w-14 shrink-0 flex-col items-center gap-1 bg-sidebar py-4">
        <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
          Y
        </div>
        {NAV.map(({ icon: Icon, label, active }) =>
          active ? (
            <Link
              key={label}
              href="/design-demo/current"
              title={label}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground"
            >
              <Icon size={18} />
            </Link>
          ) : (
            <span
              key={label}
              title={label}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-sidebar-foreground/40"
            >
              <Icon size={18} />
            </span>
          ),
        )}
        <Link
          href="/design-demo"
          title="All demos"
          className="mt-auto flex h-10 w-10 items-center justify-center rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <ArrowLeft size={16} />
        </Link>
      </aside>
      <main className="mx-auto w-full max-w-4xl px-8 py-10">{children}</main>
    </div>
  );
}
