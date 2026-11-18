"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Users,
  Building2,
  DollarSign,
  ShieldCheck,
  BarChart3,
  UserPlus,
  CheckSquare,
  Search,
  Radar,
  FileText,
  CalendarClock,
  Shield,
  Percent,
  LifeBuoy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearchStore } from "@/lib/stores/search-store";
import { isInsuranceOrgSlug } from "@/lib/tenant-vertical";

const CORE_NAV_ITEMS = [
  { href: "/", label: "Home", icon: LayoutDashboard, chip: "var(--viz-blue)" },
  { href: "/priorities", label: "Priorities", icon: CheckSquare, chip: "var(--viz-aqua)" },
  { href: "/production", label: "Production", icon: BarChart3, chip: "var(--viz-violet)" },
  { href: "/prospecting", label: "Prospecting", icon: Radar, chip: "var(--viz-violet)" },
  { href: "/leads", label: "Leads", icon: UserPlus, chip: "var(--viz-orange)" },
  { href: "/companies", label: "Companies", icon: Building2, chip: "var(--viz-yellow)" },
  { href: "/deals", label: "Deals", icon: DollarSign, chip: "var(--viz-blue)" },
  { href: "/contacts", label: "Contacts", icon: Users, chip: "var(--viz-aqua)" },
];

const INSURANCE_NAV_ITEMS = [
  { href: "/policies", label: "Policies", icon: FileText, chip: "var(--viz-violet)" },
  { href: "/renewals", label: "Renewals", icon: CalendarClock, chip: "var(--viz-orange)" },
  { href: "/carriers", label: "Carriers", icon: Shield, chip: "var(--viz-yellow)" },
  { href: "/commissions", label: "Commissions", icon: Percent, chip: "var(--viz-blue)" },
  { href: "/claims", label: "Claims", icon: LifeBuoy, chip: "var(--viz-aqua)" },
];

const ADMIN_NAV_ITEM = {
  href: "/admin",
  label: "Admin",
  icon: ShieldCheck,
  chip: "var(--viz-orange)",
};

export function SidebarNav() {
  const pathname = usePathname();
  const { orgRole, orgSlug } = useAuth();
  const isFoundry = isInsuranceOrgSlug(orgSlug);
  const navItems = [
    ...CORE_NAV_ITEMS,
    ...(isFoundry ? INSURANCE_NAV_ITEMS : []),
    ...(orgRole === "org:admin" ? [ADMIN_NAV_ITEM] : []),
  ];
  const toggleSearch = useSearchStore((s) => s.toggle);

  return (
    <nav className="flex flex-col gap-1 px-3">
      <button
        type="button"
        onClick={toggleSearch}
        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted/40 text-muted-foreground">
          <Search className="size-3.5" />
        </span>
        Search
        <span className="ml-auto text-xs text-muted-foreground">⌘K</span>
      </button>
      {navItems.map((item) => {
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-colors border-l-2 border-transparent",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-md"
              style={{
                backgroundColor: `color-mix(in oklab, ${item.chip} 22%, transparent)`,
                color: item.chip,
              }}
            >
              <Icon className="size-3.5" />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
