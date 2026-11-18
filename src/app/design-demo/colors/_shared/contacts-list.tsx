"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const CONTACT_TYPES = ["CUSTOMER", "VENDOR", "PARTNER"] as const;
type ContactType = (typeof CONTACT_TYPES)[number];

const TYPE_VARIANT: Record<ContactType, "default" | "secondary" | "outline"> = {
  CUSTOMER: "default",
  VENDOR: "secondary",
  PARTNER: "outline",
};

const TABS = [
  { value: "ALL", label: "All" },
  { value: "CUSTOMER", label: "Customers" },
  { value: "VENDOR", label: "Vendors" },
  { value: "PARTNER", label: "Partners" },
] as const;

export function ContactsList({ basePath }: { basePath: string }) {
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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<ContactType>("CUSTOMER");

  function resetForm() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setType("CUSTOMER");
  }

  function handleCreate() {
    createContact.mutate(
      { firstName, lastName, email: email || undefined, phone: phone || undefined, type },
      { onSuccess: () => { setOpen(false); resetForm(); } },
    );
  }

  const filtered =
    tab === "ALL" ? contacts.data : contacts.data?.filter((c) => c.type === tab);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Contacts</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>New Contact</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Contact</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="firstName">First name</Label>
                  <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
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
                onClick={handleCreate}
                disabled={!firstName || !lastName || createContact.isPending}
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as (typeof TABS)[number]["value"])}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab}>
          <Card className="bg-card border-border p-0 overflow-hidden">
            {contacts.isLoading ? (
              <div className="flex flex-col gap-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : filtered?.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">
                No contacts yet — create your first one.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered?.map((contact) => (
                    <TableRow key={contact.id} className="hover:bg-accent/10">
                      <TableCell>
                        <Link href={`${basePath}/${contact.id}`} className="font-medium hover:text-accent-foreground">
                          {contact.firstName} {contact.lastName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={TYPE_VARIANT[contact.type as ContactType]}>
                          {contact.type.charAt(0) + contact.type.slice(1).toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {contact.company?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{contact.email ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{contact.phone ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
