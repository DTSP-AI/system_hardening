import { CalendarDays, CheckSquare, Phone, Bell } from "lucide-react";
import { TodoBoard } from "@/components/dashboard/todo-board";
import { MyTasks } from "@/components/dashboard/my-tasks";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { CalendarSnapshot } from "@/components/dashboard/calendar-snapshot";
import { PhoneWidget } from "@/components/dashboard/phone-widget";
import { NotificationsPanel } from "@/components/dashboard/notifications-panel";

export default function OverviewPage() {
  return <div className="dashboard-page overview-dashboard">
    <div className="overview-priority-layout">
      <div className="overview-priority-board">
      <section className="dashboard-panel"><div className="dashboard-panel-heading"><div className="panel-title-icon"><CalendarDays size={18}/></div><div><h2>Upcoming schedule</h2><p>Your upcoming meetings</p></div></div><div className="dashboard-panel-body"><CalendarSnapshot /></div></section>
        <TodoBoard />
      </div>
      <div className="overview-priority-side">
      <section className="dashboard-panel"><div className="dashboard-panel-heading"><div className="panel-title-icon"><Phone size={18}/></div><div><h2>Phone</h2><p>Start a call</p></div></div><div className="dashboard-panel-body"><PhoneWidget /></div></section>
      <section className="dashboard-panel"><div className="dashboard-panel-heading"><div className="panel-title-icon"><Bell size={18}/></div><div><h2>Notifications &amp; activity</h2><p>Recent updates across your CRM</p></div></div><div className="dashboard-panel-body"><h3 className="overview-feed-label">Notifications</h3><NotificationsPanel /><h3 className="overview-feed-label overview-feed-divider">Recent activity</h3><ActivityFeed /></div></section>
      <section className="overview-tasks"><div className="overview-section-label"><CheckSquare size={17}/><h2>My tasks</h2></div><MyTasks /></section>
      </div>
    </div>
  </div>;
}
