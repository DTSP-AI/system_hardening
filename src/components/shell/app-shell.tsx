"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Search, X } from "lucide-react";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { AccountButton } from "@/components/shell/account-button";
import { SoftphoneDock } from "@/components/softphone/softphone-dock";
import { Greeting } from "@/components/dashboard/greeting";
import { DigitalClock } from "@/components/dashboard/digital-clock";
import { HeaderPhoneControls } from "@/components/dashboard/header-phone-controls";
import { useCallStore } from "@/lib/stores/call-store";
import { GlobalSearch } from "@/components/shell/global-search";
import { NotificationBell } from "@/components/shell/notification-bell";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { useSearchStore } from "@/lib/stores/search-store";
export function AppShell({ children }: { children: React.ReactNode }) {
  const [open,setOpen]=useState(false); const pathname = usePathname(); const isProduction = pathname === "/production"; const isOverview = pathname === "/"; const toggleSearch=useSearchStore(s=>s.toggle); const callStatus=useCallStore(s=>s.status);
  return <div className="crm-shell"><div className="app-backdrop"/>
    {open && <button aria-label="Close navigation" className="crm-mobile-backdrop" onClick={()=>setOpen(false)}/>}
    <aside className={`crm-sidebar ${open ? "crm-sidebar-open" : ""}`}>
      <div className="crm-sidebar-brand"><span className="crm-sidebar-wordmark">YBRYX <small>Business Operating Systems</small></span><button className="crm-close" onClick={()=>setOpen(false)} aria-label="Close navigation"><X size={19}/></button></div>
      <div className="crm-nav-scroll" onClick={()=>setOpen(false)}><SidebarNav/></div><div className="crm-account"><AccountButton/></div>
    </aside>
    <div className="crm-body"><header className={`crm-topbar ${isProduction ? "crm-topbar-production" : ""} ${isOverview ? "crm-topbar-overview" : ""} ${isProduction ? "crm-topbar-greeting" : ""}`}><button className="crm-menu" onClick={()=>setOpen(true)} aria-label="Open navigation"><Menu size={21}/></button>{(isOverview || isProduction) && <h1 className="crm-header-greeting"><Greeting /></h1>}<button className="crm-search" onClick={toggleSearch} aria-label="Search CRM"><Search size={18}/><span>Search leads, contacts, deals, and more...</span><kbd>⌘ K</kbd></button><div className="crm-top-actions">{callStatus!=="idle" && <HeaderPhoneControls/>}<ThemeToggle/><NotificationBell/><DigitalClock align="right"/></div></header><main className={`crm-main ${isProduction ? "crm-main-production" : ""}`}>{children}</main></div>
    <SoftphoneDock/><GlobalSearch/>
  </div>;
}
