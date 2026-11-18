import Link from "next/link";
import { ArrowUpRight, BarChart3, CheckCircle2, Clock3, Plus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CalendarSnapshot } from "@/components/dashboard/calendar-snapshot";
import { PhoneWidget } from "@/components/dashboard/phone-widget";
import { NotificationsPanel } from "@/components/dashboard/notifications-panel";
import { TodoBoard } from "@/components/dashboard/todo-board";
import { MyTasks } from "@/components/dashboard/my-tasks";
import { KpiTiles } from "@/components/dashboard/kpi-tiles";
import { PipelineChart } from "@/components/dashboard/pipeline-chart";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { RecentLeads } from "@/components/dashboard/recent-leads";
import { Greeting } from "@/components/dashboard/greeting";

export default function HomePage() {
  return <div className="dashboard-page">
    <div className="dashboard-welcome"><div><h1><Greeting/></h1><p>Here’s where your business stands today.</p></div><Link href="/leads" className="dashboard-action"><Plus size={18}/> Manage leads</Link></div>
    <KpiTiles/>
    <div className="dashboard-primary-grid"><section className="dashboard-panel"><div className="dashboard-panel-heading"><div className="panel-title-icon"><BarChart3 size={19}/></div><div><h2>Pipeline performance</h2><p>Pipeline added per week</p></div><Link href="/deals">View pipeline <ArrowUpRight size={14}/></Link></div><div className="dashboard-panel-body"><PipelineChart/></div></section><section className="dashboard-panel"><div className="dashboard-panel-heading"><div className="panel-title-icon"><CheckCircle2 size={19}/></div><div><h2>Your priorities</h2><p>Tasks to keep your momentum</p></div><Link href="/priorities">View all <ArrowUpRight size={14}/></Link></div><MyTasks/></section></div>
    <div className="dashboard-primary-grid"><RecentLeads/><section className="dashboard-panel"><div className="dashboard-panel-heading"><div className="panel-title-icon"><Clock3 size={19}/></div><div><h2>Recent activity</h2><p>Latest updates across your CRM</p></div></div><div className="dashboard-panel-body"><ActivityFeed/></div></section></div>
    <details className="dashboard-more"><summary>More workspace tools</summary><div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3"><TodoBoard/><Card><CardHeader><CardTitle>Today’s schedule</CardTitle></CardHeader><CardContent><CalendarSnapshot/></CardContent></Card><div className="flex flex-col gap-4"><Card><CardHeader><CardTitle>Phone</CardTitle></CardHeader><CardContent><PhoneWidget/></CardContent></Card><Card><CardHeader><CardTitle>Notifications</CardTitle></CardHeader><CardContent><NotificationsPanel/></CardContent></Card></div></div></details>
  </div>;
}
