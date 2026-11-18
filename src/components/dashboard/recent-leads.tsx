"use client";
import Link from "next/link";
import { ArrowUpRight, UserRound } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";

export function RecentLeads() {
  const leads=trpc.lead.list.useQuery();
  return <section className="dashboard-panel recent-leads"><div className="dashboard-panel-heading"><div className="panel-title-icon"><UserRound size={18}/></div><div><h2>Recent leads</h2><p>Latest leads added to your CRM</p></div><Link href="/leads">View all <ArrowUpRight size={14}/></Link></div>
    <div className="recent-leads-scroll"><table><thead><tr><th>Name</th><th>Company</th><th>Stage</th><th>Source</th><th>Added</th></tr></thead><tbody>
      {leads.isLoading ? Array.from({length:3},(_,i)=><tr key={i}><td colSpan={5}><Skeleton className="h-8 w-full"/></td></tr>) : (leads.data??[]).slice(0,5).map(lead=><tr key={lead.id}><td><Link href={`/leads/${lead.id}`} className="font-semibold hover:underline">{lead.firstName} {lead.lastName}</Link></td><td>{lead.companyName || "—"}</td><td><span className="lead-stage">{lead.status.replaceAll("_"," ")}</span></td><td>{lead.source || "—"}</td><td>{new Date(lead.createdAt).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</td></tr>)}
    </tbody></table>{!leads.isLoading && !leads.data?.length && <p className="p-4 text-sm text-muted-foreground">No leads yet.</p>}</div>
  </section>;
}
