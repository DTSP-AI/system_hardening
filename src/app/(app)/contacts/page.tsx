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
import { ExportCsvButton } from "@/components/shared/export-csv-button";
import { ImportCsvDialog, type ImportField } from "@/components/shared/import-csv-dialog";
import { useCurrentRole } from "@/lib/hooks/use-current-role";
import { useRowSelection } from "@/lib/hooks/use-row-selection";
import { BulkActionsToolbar } from "@/components/shared/bulk-actions-toolbar";
import { BulkTagSelect } from "@/components/shared/bulk-tag-select";
import { Checkbox } from "@/components/ui/checkbox";
import type { CsvColumn } from "@/lib/csv";
import type { RouterOutputs } from "@/lib/trpc/types";

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

type ContactRow = RouterOutputs["contact"]["list"][number];

const CONTACT_CSV_COLUMNS: CsvColumn<ContactRow>[] = [
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "type", label: "Type" },
  { key: "company", label: "Company", accessor: (c) => c.company?.name },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "jobTitle", label: "Job Title" },
  { key: "leadSource", label: "Lead Source" },
  { key: "addressLine1", label: "Address Line 1" },
  { key: "addressLine2", label: "Address Line 2" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "postalCode", label: "Postal Code" },
  { key: "country", label: "Country" },
];

const CONTACT_IMPORT_FIELDS: ImportField[] = [
  { key: "firstName", label: "First Name", required: true },
  { key: "lastName", label: "Last Name", required: true },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "jobTitle", label: "Job Title" },
  { key: "leadSource", label: "Lead Source" },
  { key: "type", label: "Type" },
  { key: "addressLine1", label: "Address Line 1" },
  { key: "addressLine2", label: "Address Line 2" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "postalCode", label: "Postal Code" },
  { key: "country", label: "Country" },
];

export default function ContactsPage() {
  const utils = trpc.useUtils();
  const { isAdmin } = useCurrentRole();
  const contacts = trpc.contact.list.useQuery();
  const createContact = trpc.contact.create.useMutation({
    onSuccess: () => {
      utils.contact.list.invalidate();
      toast.success("Contact created");
    },
    onError: (err) => toast.error(err.message),
  });
  const bulkCreateContacts = trpc.contact.bulkCreate.useMutation({
    onSuccess: (result) => {
      utils.contact.list.invalidate();
      toast.success(`Imported ${result.count} contact${result.count === 1 ? "" : "s"}`);
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteManyContacts = trpc.contact.deleteMany.useMutation({
    onSuccess: (result) => {
      utils.contact.list.invalidate();
      toast.success(`Deleted ${result.count} contact${result.count === 1 ? "" : "s"}`);
      clearSelection();
    },
    onError: (err) => toast.error(err.message),
  });

  async function handleImportContacts(rows: Record<string, string>[]) {
    await bulkCreateContacts.mutateAsync({
      rows: rows.map((row) => ({
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email || undefined,
        phone: row.phone || undefined,
        jobTitle: row.jobTitle || undefined,
        leadSource: row.leadSource || undefined,
        type: CONTACT_TYPES.includes(row.type as ContactType) ? (row.type as ContactType) : undefined,
        addressLine1: row.addressLine1 || undefined,
        addressLine2: row.addressLine2 || undefined,
        city: row.city || undefined,
        state: row.state || undefined,
        postalCode: row.postalCode || undefined,
        country: row.country || undefined,
      })),
    });
  }

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

  const {
    isSelected,
    selectedIds,
    toggle,
    toggleAll,
    clear: clearSelection,
    allSelected,
  } = useRowSelection(filtered);

  function handleBulkDelete() {
    if (!window.confirm(`Delete ${selectedIds.length} contact${selectedIds.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
    deleteManyContacts.mutate({ ids: selectedIds });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Contacts</h1>
        <div className="flex items-center gap-2">
          <ExportCsvButton
            data={filtered}
            columns={CONTACT_CSV_COLUMNS}
            filename="contacts.csv"
          />
          {isAdmin && (
            <ImportCsvDialog
              title="Import Contacts"
              fields={CONTACT_IMPORT_FIELDS}
              onImport={handleImportContacts}
              isImporting={bulkCreateContacts.isPending}
            />
          )}
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
      </div>

      <BulkActionsToolbar count={selectedIds.length} onClear={clearSelection}>
        <BulkTagSelect entityType="CONTACT" entityIds={selectedIds} onDone={clearSelection} />
        {isAdmin && (
          <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={deleteManyContacts.isPending}>
            Delete selected
          </Button>
        )}
      </BulkActionsToolbar>

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
                    <TableHead className="w-8">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered?.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <Checkbox
                          checked={isSelected(contact.id)}
                          onCheckedChange={() => toggle(contact.id)}
                          aria-label={`Select ${contact.firstName} ${contact.lastName}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Link href={`/contacts/${contact.id}`} className="font-medium hover:text-accent-foreground">
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
