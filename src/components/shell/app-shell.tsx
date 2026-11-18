"use client";
import { useState } from "react";
import { Menu, Search, X } from "lucide-react";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { AccountButton } from "@/components/shell/account-button";
import { SoftphoneDock } from "@/components/softphone/softphone-dock";
import { StatusBar } from "@/components/dashboard/status-bar";
import { GlobalSearch } from "@/components/shell/global-search";
import { NotificationBell } from "@/components/shell/notification-bell";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { BrandMark } from "@/components/shell/brand-mark";
import { useSearchStore } from "@/lib/stores/search-store";
export function AppShell({ children }: { children: React.ReactNode }) {
  const [open,setOpen]=useState(false); const toggleSearch=useSearchStore(s=>s.toggle);
  return <div className="crm-shell"><div className="app-backdrop"/>
    {open && <button aria-label="Close navigation" className="crm-mobile-backdrop" onClick={()=>setOpen(false)}/>}
    <aside className={`crm-sidebar ${open ? "crm-sidebar-open" : ""}`}>
      <div className="crm-sidebar-brand"><BrandMark/><span>YBRYX <small>CRM</small></span><button className="crm-close" onClick={()=>setOpen(false)} aria-label="Close navigation"><X size={19}/></button></div>
      <div className="crm-workspace">YBRYX <span>•</span> Workspace</div>
      <div className="crm-nav-scroll" onClick={()=>setOpen(false)}><SidebarNav/></div><div className="crm-account"><AccountButton/></div>
    </aside>
    <div className="crm-body"><header className="crm-topbar"><button className="crm-menu" onClick={()=>setOpen(true)} aria-label="Open navigation"><Menu size={21}/></button><button className="crm-search" onClick={toggleSearch}><Search size={18}/><span>Search leads, contacts, deals, and more...</span><kbd>⌘ K</kbd></button><div className="crm-top-actions"><ThemeToggle/><NotificationBell/></div></header><StatusBar/><main className="crm-main">{children}</main></div>
    <SoftphoneDock/><GlobalSearch/>
  </div>;
}
