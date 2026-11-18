"use client";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Building2, CalendarDays, Link2, Mail, Phone, UserRound } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TagPicker } from "@/components/tag-picker";
import { AttachmentsList } from "@/components/shared/attachments-list";
import { toast } from "sonner";

const STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "UNQUALIFIED", "CONVERTED"] as const;
function Field({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: React.ReactNode }) {
  return <div className="lead-field"><Icon size={17}/><span>{label}</span><div>{value}</div></div>;
}
export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }=use(params); const router=useRouter(); const utils=trpc.useUtils(); const lead=trpc.lead.byId.useQuery({id});
  const setStatus=trpc.lead.setStatus.useMutation({onSuccess:()=>utils.lead.byId.invalidate({id}),onError:(err)=>toast.error(err.message)});
  const convert=trpc.lead.convert.useMutation({onSuccess:(contact)=>{toast.success("Lead converted to contact");utils.lead.byId.invalidate({id});router.push(`/contacts/${contact.id}`)},onError:(err)=>toast.error(err.message)});
  if(lead.isLoading)return <div className="space-y-4"><Skeleton className="h-10 w-64"/><Skeleton className="h-56 w-full"/></div>;
  if(lead.isError)return <div className="p-6 text-sm text-muted-foreground">Unable to load this lead. <Link className="text-primary underline" href="/leads">Return to leads</Link></div>;
  if(!lead.data)return null;
  const item=lead.data; const converted=item.status==="CONVERTED"; const initials=`${item.firstName[0]??""}${item.lastName[0]??""}`.toUpperCase();
  return <div className="lead-page"><Link className="lead-breadcrumb" href="/leads"><ArrowLeft size={14}/> Leads <span>/</span> {item.firstName} {item.lastName}</Link>
    <header className="lead-header"><div className="lead-avatar">{initials}</div><div className="lead-title"><div><h1>{item.firstName} {item.lastName}</h1><Badge variant={converted?"outline":"default"}>{item.status.replaceAll("_"," ")}</Badge></div><p>{[item.jobTitle,item.companyName].filter(Boolean).join(" • ") || "Lead profile"}</p></div><div className="lead-header-actions">{item.email && <Button variant="outline" asChild><a href={`mailto:${item.email}`}><Mail size={16}/> Email</a></Button>}{item.phone && <Button variant="outline" asChild><a href={`tel:${item.phone}`}><Phone size={16}/> Call</a></Button>}</div></header>
    <div className="lead-layout"><div className="lead-sidebar"><Card className="lead-card"><h2>Contact details</h2><div className="lead-fields"><Field icon={Mail} label="Email" value={item.email ? <a href={`mailto:${item.email}`}>{item.email}</a>:"—"}/><Field icon={Phone} label="Phone" value={item.phone ? <a href={`tel:${item.phone}`}>{item.phone}</a>:"—"}/><Field icon={Building2} label="Company" value={item.companyName??"—"}/><Field icon={Link2} label="Lead source" value={item.source??"—"}/><Field icon={UserRound} label="Role" value={item.jobTitle??"—"}/><Field icon={CalendarDays} label="Added" value={new Date(item.createdAt).toLocaleDateString()}/></div><div className="lead-tags"><TagPicker entityType="LEAD" entityId={id}/></div></Card>
      <Card className="lead-card"><h2>Lead status</h2><p className="lead-caption">Keep the stage up to date as your conversation progresses.</p><Select value={item.status} onValueChange={value=>setStatus.mutate({id,status:value as (typeof STATUSES)[number]})} disabled={converted}><SelectTrigger className="w-full"><SelectValue/></SelectTrigger><SelectContent>{STATUSES.map(status=><SelectItem key={status} value={status}>{status.replaceAll("_"," ")}</SelectItem>)}</SelectContent></Select>{converted && item.convertedContactId ? <Button asChild variant="outline" className="mt-3 w-full"><Link href={`/contacts/${item.convertedContactId}`}>View converted contact <ArrowUpRight size={15}/></Link></Button> : <Button className="mt-3 w-full" onClick={()=>convert.mutate({id})} disabled={convert.isPending}>Convert to contact <ArrowUpRight size={15}/></Button>}</Card></div>
      <div className="lead-main"><Card className="lead-card lead-overview"><div className="lead-panel-tabs"><span>Overview</span></div><h2>About this lead</h2><p>When you’re ready, convert this lead to a contact to track deals and activity in the CRM.</p><div className="lead-next-step"><div className="lead-next-icon"><UserRound size={20}/></div><div><strong>Continue the conversation</strong><p>Review the contact details and keep the lead status current.</p></div></div></Card><Card className="lead-card"><AttachmentsList entityType="LEAD" entityId={id}/></Card></div></div>
  </div>;
}
