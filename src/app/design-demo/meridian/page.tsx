"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const CONTACT_TYPES = ["CUSTOMER", "VENDOR", "PARTNER"] as const;
type ContactType = (typeof CONTACT_TYPES)[number];

export default function MeridianContactsPage() {
  const utils = trpc.useUtils();
  const contacts = trpc.contact.list.useQuery();
  const createContact = trpc.contact.create.useMutation({
    onSuccess: () => {
      utils.contact.list.invalidate();
      toast.success("Contact created");
    },
    onError: (err) => toast.error(err.message),
  });

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [type, setType] = useState<ContactType>("CUSTOMER");

  const filtered = (contacts.data ?? []).filter((c) =>
    query
      ? `${c.firstName} ${c.lastName} ${c.email ?? ""}`.toLowerCase().includes(query.toLowerCase())
      : true,
  );

  function handleCreate() {
    createContact.mutate(
      { firstName, lastName, email: email || undefined, type },
      {
        onSuccess: () => {
          setOpen(false);
          setFirstName("");
          setLastName("");
          setEmail("");
          setType("CUSTOMER");
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-t border border-border bg-card px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold">Contacts</h1>
          <p className="text-xs text-muted-foreground">{filtered.length} items</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search this list..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 w-56 text-sm"
          />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">New</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Contact</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label>First name</Label>
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Last name</Label>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as ContactType)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTACT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t.charAt(0) + t.slice(1).toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={!firstName || !lastName || createContact.isPending}>
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="overflow-hidden rounded-b border border-t-0 border-border">
        {contacts.isLoading ? (
          <div className="flex flex-col gap-1 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No records to display.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary hover:bg-secondary">
                <TableHead className="h-8 text-xs">Name</TableHead>
                <TableHead className="h-8 text-xs">Type</TableHead>
                <TableHead className="h-8 text-xs">Account</TableHead>
                <TableHead className="h-8 text-xs">Email</TableHead>
                <TableHead className="h-8 text-xs">Phone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((contact, i) => (
                <TableRow
                  key={contact.id}
                  className={`h-9 ${i % 2 === 1 ? "bg-secondary/40" : ""} hover:bg-accent/50`}
                >
                  <TableCell className="py-1.5 text-sm">
                    <Link
                      href={`/design-demo/meridian/${contact.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {contact.firstName} {contact.lastName}
                    </Link>
                  </TableCell>
                  <TableCell className="py-1.5 text-sm text-muted-foreground">
                    {contact.type.charAt(0) + contact.type.slice(1).toLowerCase()}
                  </TableCell>
                  <TableCell className="py-1.5 text-sm text-muted-foreground">
                    {contact.company?.name ?? "—"}
                  </TableCell>
                  <TableCell className="py-1.5 text-sm text-muted-foreground">
                    {contact.email ?? "—"}
                  </TableCell>
                  <TableCell className="py-1.5 text-sm text-muted-foreground">
                    {contact.phone ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
