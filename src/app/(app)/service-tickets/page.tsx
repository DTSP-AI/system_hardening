"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const SERVICE_ISSUE_TYPES = [
  "PERFORMANCE",
  "EQUIPMENT_FAILURE",
  "ROOF_LEAK",
  "MONITORING",
  "BILLING",
  "WARRANTY",
  "OTHER",
] as const;

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  OPEN: "default",
  SCHEDULED: "secondary",
  IN_PROGRESS: "secondary",
  RESOLVED: "secondary",
  CLOSED: "outline",
};

export default function ServiceTicketsPage() {
  const utils = trpc.useUtils();
  const tickets = trpc.serviceTicket.list.useQuery({});
  const projects = trpc.project.list.useQuery({});
  const createTicket = trpc.serviceTicket.create.useMutation({
    onSuccess: () => {
      utils.serviceTicket.list.invalidate();
      toast.success("Service ticket created");
    },
    onError: (err) => toast.error(err.message),
  });

  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");
  const [issueType, setIssueType] = useState<string>("OTHER");
  const [description, setDescription] = useState("");

  function resetForm() {
    setProjectId("");
    setTicketNumber("");
    setIssueType("OTHER");
    setDescription("");
  }

  function handleCreate() {
    if (!projectId || !ticketNumber) return;
    createTicket.mutate(
      {
        projectId,
        ticketNumber,
        issueType: issueType as (typeof SERVICE_ISSUE_TYPES)[number],
        description: description || undefined,
      },
      { onSuccess: () => { setOpen(false); resetForm(); } },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Service Tickets</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>New Ticket</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Service Ticket</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Project</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.data?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.projectNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ticketNumber">Ticket Number</Label>
                <Input id="ticketNumber" value={ticketNumber} onChange={(e) => setTicketNumber(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Issue Type</Label>
                <Select value={issueType} onValueChange={setIssueType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_ISSUE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.replaceAll("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">Description</Label>
                <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={!projectId || !ticketNumber || createTicket.isPending}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-card border-border p-0 overflow-hidden">
        {tickets.isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : tickets.data?.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            No service tickets yet — create your first one.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket #</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.data?.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell className="font-medium text-card-foreground">{ticket.ticketNumber}</TableCell>
                  <TableCell>
                    <Link href={`/projects/${ticket.projectId}`} className="text-muted-foreground hover:text-accent-foreground">
                      {ticket.project.projectNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{ticket.issueType.replaceAll("_", " ")}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[ticket.status] ?? "outline"}>{ticket.status.replaceAll("_", " ")}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
