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
import { toast } from "sonner";

const CONTACT_TYPES = ["CUSTOMER", "VENDOR", "PARTNER"] as const;
type ContactType = (typeof CONTACT_TYPES)[number];

const TABS = [
  { value: "ALL", label: "All contacts" },
  { value: "CUSTOMER", label: "Customers" },
  { value: "VENDOR", label: "Vendors" },
  { value: "PARTNER", label: "Partners" },
] as const;

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

export default function BeaconContactsPage() {
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
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("ALL");
  const [query, setQuery] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [type, setType] = useState<ContactType>("CUSTOMER");

  const filtered = (contacts.data ?? [])
    .filter((c) => tab === "ALL" || c.type === tab)
    .filter((c) =>
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
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contacts</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full">Create contact</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create contact</DialogTitle>
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
              <Button
                className="rounded-full"
                onClick={handleCreate}
                disabled={!firstName || !lastName || createContact.isPending}
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-6 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`-mb-px border-b-2 pb-3 text-sm font-medium transition ${
              tab === t.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Input
        placeholder="Search contacts by name or email..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm rounded-full"
      />

      <div className="overflow-hidden rounded-xl border border-border">
        {contacts.isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">No contacts match.</div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((contact) => (
              <Link
                key={contact.id}
                href={`/design-demo/beacon/${contact.id}`}
                className="flex items-center gap-4 px-5 py-4 transition hover:bg-secondary/60"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                  {initials(contact.firstName, contact.lastName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {contact.firstName} {contact.lastName}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {contact.email ?? "No email"} {contact.company ? `· ${contact.company.name}` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                  {contact.type.charAt(0) + contact.type.slice(1).toLowerCase()}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
