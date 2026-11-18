import { auth } from "@clerk/nextjs/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { NotificationsPanel } from "@/components/dashboard/notifications-panel";
import { CalendarSnapshot } from "@/components/dashboard/calendar-snapshot";
import { PhoneWidget } from "@/components/dashboard/phone-widget";
import { RenewalsDue } from "@/components/dashboard/renewals-due";
import { TodoBoard } from "@/components/dashboard/todo-board";
import { KpiTiles } from "@/components/dashboard/kpi-tiles";
import { PipelineChart } from "@/components/dashboard/pipeline-chart";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { isInsuranceOrgSlug } from "@/lib/tenant-vertical";

export default async function HomePage() {
  const { orgSlug } = await auth();
  const isFoundry = isInsuranceOrgSlug(orgSlug);

  const panelTitle = "text-xs font-semibold tracking-wide text-muted-foreground uppercase";

  return (
    <div className="flex flex-col gap-4">
      <KpiTiles />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className={panelTitle}>Pipeline added per week</CardTitle>
          </CardHeader>
          <CardContent>
            <PipelineChart />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className={panelTitle}>Latest Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityFeed />
          </CardContent>
        </Card>
      </div>

      <div className={`grid grid-cols-1 items-start gap-4 ${isFoundry ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        <TodoBoard />
        <Card>
          <CardHeader>
            <CardTitle className={panelTitle}>Today&apos;s Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <CalendarSnapshot />
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className={panelTitle}>Phone</CardTitle>
            </CardHeader>
            <CardContent>
              <PhoneWidget />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className={panelTitle}>Notifications</CardTitle>
            </CardHeader>
            <CardContent>
              <NotificationsPanel />
            </CardContent>
          </Card>
        </div>
        {isFoundry && (
          <Card>
            <CardHeader>
              <CardTitle className={panelTitle}>Renewals Due</CardTitle>
            </CardHeader>
            <CardContent>
              <RenewalsDue />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
