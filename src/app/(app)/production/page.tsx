"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PipelineFunnel } from "@/components/pipeline-funnel";
import { PipelineDonut } from "@/components/pipeline-donut";
import { BarChart3, PieChart } from "lucide-react";

function StatTile({
  label,
  value,
  isLoading,
}: {
  label: string;
  value: number | undefined;
  isLoading: boolean;
}) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <span className="text-3xl font-bold text-card-foreground">{value ?? 0}</span>
        )}
      </CardContent>
    </Card>
  );
}

export default function ProductionPage() {
  const contacts = trpc.contact.list.useQuery();
  const companies = trpc.company.list.useQuery();
  const deals = trpc.deal.list.useQuery();
  const stages = trpc.pipelineStage.list.useQuery();

  const openDeals = deals.data?.filter((d) => d.status === "OPEN").length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">Production</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Contacts" value={contacts.data?.length} isLoading={contacts.isLoading} />
        <StatTile label="Companies" value={companies.data?.length} isLoading={companies.isLoading} />
        <StatTile label="Open Deals" value={openDeals} isLoading={deals.isLoading} />
        <StatTile label="Total Deals" value={deals.data?.length} isLoading={deals.isLoading} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="bg-card border-border lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-base font-semibold text-card-foreground">
              <span className="panel-title-icon"><BarChart3 size={19} /></span>
              <span>Pipeline by stage <span className="block text-xs font-normal text-muted-foreground">Deal value and count across your pipeline</span></span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PipelineFunnel
              stages={stages.data}
              deals={deals.data}
              isLoading={stages.isLoading || deals.isLoading}
            />
          </CardContent>
        </Card>
        <Card className="bg-card border-border lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-base font-semibold text-card-foreground">
              <span className="panel-title-icon"><PieChart size={19} /></span>
              <span>Value by stage <span className="block text-xs font-normal text-muted-foreground">Share of total pipeline value</span></span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PipelineDonut
              stages={stages.data}
              deals={deals.data}
              isLoading={stages.isLoading || deals.isLoading}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
