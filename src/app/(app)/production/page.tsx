"use client";

import Link from "next/link";
import { ArrowUpRight, BarChart3, Clock3, PieChart, Plus, UsersRound, Building2, BriefcaseBusiness } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CalendarSnapshot } from "@/components/dashboard/calendar-snapshot";
import { PhoneWidget } from "@/components/dashboard/phone-widget";
import { NotificationsPanel } from "@/components/dashboard/notifications-panel";
import { KpiTiles } from "@/components/dashboard/kpi-tiles";
import { PipelineChart } from "@/components/dashboard/pipeline-chart";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { RecentLeads } from "@/components/dashboard/recent-leads";
import { Greeting } from "@/components/dashboard/greeting";
import { PipelineFunnel } from "@/components/pipeline-funnel";
import { PipelineDonut } from "@/components/pipeline-donut";

export default function ProductionPage() {
  const contacts = trpc.contact.list.useQuery();
  const companies = trpc.company.list.useQuery();
  const deals = trpc.deal.list.useQuery();
  const stages = trpc.pipelineStage.list.useQuery();
  const openDeals = deals.data?.filter((deal) => deal.status === "OPEN");
  const loadingPipeline = stages.isLoading || deals.isLoading;
  const records = [
    { label: "Contacts", value: contacts.data?.length, loading: contacts.isLoading, error: contacts.isError, href: "/contacts", icon: UsersRound },
    { label: "Companies", value: companies.data?.length, loading: companies.isLoading, error: companies.isError, href: "/companies", icon: Building2 },
    { label: "Total deals", value: deals.data?.length, loading: deals.isLoading, error: deals.isError, href: "/deals", icon: BriefcaseBusiness },
  ];

  return <div className="dashboard-page production-dashboard">
    <div className="dashboard-welcome"><div><h1><Greeting /></h1><p>Production overview · Your pipeline, relationships, and activity in one place.</p></div><Link href="/leads" className="dashboard-action"><Plus size={16} /> Manage leads</Link></div>
    <KpiTiles />
    <div className="production-records" aria-label="CRM record counts">{records.map(({label,value,loading,error,href,icon:Icon}) => <Link href={href} className="production-record" key={label}><Icon size={16}/><span>{label}</span><strong>{loading ? "…" : error ? "Unavailable" : value ?? 0}</strong><ArrowUpRight size={13}/></Link>)}</div>
    <div className="production-chart-grid">
      <section className="dashboard-panel"><div className="dashboard-panel-heading"><div className="panel-title-icon"><BarChart3 size={18}/></div><div><h2>Pipeline added by week</h2><p>Value of all deals created in the last 8 weeks</p></div><Link href="/deals">View deals <ArrowUpRight size={14}/></Link></div><div className="dashboard-panel-body production-weekly-chart"><PipelineChart /></div></section>
      <section className="dashboard-panel"><div className="dashboard-panel-heading"><div className="panel-title-icon"><BarChart3 size={18}/></div><div><h2>Open pipeline by stage</h2><p>Current open deal value and count</p></div></div><div className="dashboard-panel-body">{deals.isError || stages.isError ? <p className="text-sm text-muted-foreground">Unable to load pipeline data.</p> : <PipelineFunnel stages={stages.data} deals={openDeals} isLoading={loadingPipeline}/>}</div></section>
      <section className="dashboard-panel"><div className="dashboard-panel-heading"><div className="panel-title-icon"><PieChart size={18}/></div><div><h2>Open pipeline mix</h2><p>Share of current open deal value</p></div></div><div className="dashboard-panel-body">{deals.isError || stages.isError ? <p className="text-sm text-muted-foreground">Unable to load pipeline data.</p> : <PipelineDonut stages={stages.data} deals={openDeals} isLoading={loadingPipeline}/>}</div></section>
    </div>
    <div className="dashboard-primary-grid"><RecentLeads/><section className="dashboard-panel"><div className="dashboard-panel-heading"><div className="panel-title-icon"><Clock3 size={18}/></div><div><h2>Recent activity</h2><p>Latest updates across your CRM</p></div></div><div className="dashboard-panel-body"><ActivityFeed/></div></section></div>
    <details className="dashboard-more"><summary>More workspace tools</summary><div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3"><Card><CardHeader><CardTitle>Today’s schedule</CardTitle></CardHeader><CardContent><CalendarSnapshot/></CardContent></Card><div className="flex flex-col gap-4"><Card><CardHeader><CardTitle>Phone</CardTitle></CardHeader><CardContent><PhoneWidget/></CardContent></Card><Card><CardHeader><CardTitle>Notifications</CardTitle></CardHeader><CardContent><NotificationsPanel/></CardContent></Card></div></div></details>
  </div>;
}
