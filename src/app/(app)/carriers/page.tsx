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
import { toast } from "sonner";

export default function CarriersPage() {
  const utils = trpc.useUtils();
  const carriers = trpc.carrier.list.useQuery();
  const createCarrier = trpc.carrier.create.useMutation({
    onSuccess: () => {
      utils.carrier.list.invalidate();
      toast.success("Carrier created");
    },
    onError: (err) => toast.error(err.message),
  });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [naicCode, setNaicCode] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");

  function resetForm() {
    setName("");
    setNaicCode("");
    setPhone("");
    setWebsite("");
  }

  function handleCreate() {
    createCarrier.mutate(
      {
        name,
        naicCode: naicCode || undefined,
        phone: phone || undefined,
        website: website || undefined,
      },
      { onSuccess: () => { setOpen(false); resetForm(); } },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Carriers</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>New Carrier</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Carrier</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="naicCode">NAIC Code</Label>
                <Input id="naicCode" value={naicCode} onChange={(e) => setNaicCode(e.target.value)} />
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
              <Button onClick={handleCreate} disabled={!name || createCarrier.isPending}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-card border-border p-0 overflow-hidden">
        {carriers.isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : carriers.data?.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            No carriers yet — create your first one.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>NAIC Code</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Website</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carriers.data?.map((carrier) => (
                <TableRow key={carrier.id}>
                  <TableCell className="font-medium text-card-foreground">
                    <Link href={`/carriers/${carrier.id}`} className="hover:text-accent-foreground">
                      {carrier.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{carrier.naicCode ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{carrier.phone ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{carrier.website ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
