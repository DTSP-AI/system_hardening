"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  LayoutDashboard,
  Landmark,
  DollarSign,
  ShieldCheck,
  BarChart3,
  UserPlus,
  Radar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentRole } from "@/lib/hooks/use-current-role";

const CORE_NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard, chip: "var(--viz-blue)" },
  { href: "/production", label: "Production", icon: BarChart3, chip: "var(--viz-violet)" },
  { href: "/prospecting", label: "Prospecting", icon: Radar, chip: "var(--viz-violet)" },
  { href: "/leads", label: "Leads", icon: UserPlus, chip: "var(--viz-orange)" },
  { href: "/deals", label: "Deals", icon: DollarSign, chip: "var(--viz-blue)" },
  { href: "/accounts", label: "Accounts", icon: Landmark, chip: "var(--viz-yellow)" },
  { href: "/contacts", label: "Contacts", icon: Users, chip: "var(--viz-aqua)" },
];

const ADMIN_NAV_ITEM = {
  href: "/admin",
  label: "Admin",
  icon: ShieldCheck,
  chip: "var(--viz-orange)",
};

export function SidebarNav() {
  const pathname = usePathname();
  const { isAdmin } = useCurrentRole();
  const navItems = [
    ...CORE_NAV_ITEMS,
    ...(isAdmin ? [ADMIN_NAV_ITEM] : []),
  ];

  return (
    <nav className="flex flex-col gap-1 px-3">
      {navItems.map((item) => {
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "crm-nav-item flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
              isActive
                ? "crm-nav-active bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-md"
              style={{
                backgroundColor: "transparent",
                color: "currentColor",
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
