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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const VENDOR_TYPES = [
  "PANEL_MANUFACTURER",
  "INVERTER_MANUFACTURER",
  "BATTERY_MANUFACTURER",
  "RACKING_MANUFACTURER",
  "DISTRIBUTOR",
  "OTHER",
] as const;

export default function VendorsPage() {
  const utils = trpc.useUtils();
  const vendors = trpc.vendor.list.useQuery({});
  const createVendor = trpc.vendor.create.useMutation({
    onSuccess: () => {
      utils.vendor.list.invalidate();
      toast.success("Vendor created");
    },
    onError: (err) => toast.error(err.message),
  });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("OTHER");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");

  function resetForm() {
    setName("");
    setType("OTHER");
    setPhone("");
    setWebsite("");
  }

  function handleCreate() {
    createVendor.mutate(
      {
        name,
        type: type as (typeof VENDOR_TYPES)[number],
        phone: phone || undefined,
        website: website || undefined,
      },
      { onSuccess: () => { setOpen(false); resetForm(); } },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Vendors</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>New Vendor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Vendor</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VENDOR_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.replaceAll("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="website">Website</Label>
                <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={!name || createVendor.isPending}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-card border-border p-0 overflow-hidden">
        {vendors.isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : vendors.data?.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            No vendors yet — create your first one.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Website</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.data?.map((vendor) => (
                <TableRow key={vendor.id}>
                  <TableCell className="font-medium text-card-foreground">
                    <Link href={`/vendors/${vendor.id}`} className="hover:text-accent-foreground">
                      {vendor.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{vendor.type.replaceAll("_", " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{vendor.phone ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{vendor.website ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
