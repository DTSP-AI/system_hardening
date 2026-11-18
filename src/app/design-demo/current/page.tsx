"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, Mail } from "lucide-react";
import { toast } from "sonner";

const CONTACT_TYPES = ["CUSTOMER", "VENDOR", "PARTNER"] as const;
type ContactType = (typeof CONTACT_TYPES)[number];

export default function CurrentContactsPage() {
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
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">People</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>+ Add person</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add person</DialogTitle>
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
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Input
        placeholder="Search people..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-md"
      />

      {contacts.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No people match your search.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center justify-between rounded-lg px-3 py-4 transition hover:bg-secondary"
            >
              <Link href={`/design-demo/current/${contact.id}`} className="min-w-0 flex-1">
                <p className="truncate text-base font-medium">
                  {contact.firstName} {contact.lastName}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {contact.company?.name ?? "No company"}
                </p>
              </Link>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
                  {contact.type.charAt(0) + contact.type.slice(1).toLowerCase()}
                </span>
                <button
                  title={contact.phone ?? "No phone"}
                  disabled={!contact.phone}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-30"
                >
                  <Phone size={15} />
                </button>
                <button
                  title={contact.email ?? "No email"}
                  disabled={!contact.email}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-30"
                >
                  <Mail size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
