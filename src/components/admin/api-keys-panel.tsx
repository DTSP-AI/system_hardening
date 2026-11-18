"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ApiKeysPanel() {
  const utils = trpc.useUtils();
  const apiKeys = trpc.apiKey.list.useQuery();
  const createKey = trpc.apiKey.create.useMutation({
    onSuccess: (data) => {
      utils.apiKey.list.invalidate();
      setNewKey(data.key);
    },
    onError: (err) => toast.error(err.message),
  });
  const revokeKey = trpc.apiKey.revoke.useMutation({
    onSuccess: () => {
      utils.apiKey.list.invalidate();
      toast.success("Key revoked");
    },
    onError: (err) => toast.error(err.message),
  });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setName("");
      setNewKey(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Keys authenticate external integrations against this workspace&apos;s API.
        </p>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button>New API Key</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New API Key</DialogTitle>
            </DialogHeader>
            {newKey ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  Copy this key now — it won&apos;t be shown again.
                </p>
                <code className="break-all rounded-md border border-border bg-muted px-3 py-2 text-xs text-popover-foreground">
                  {newKey}
                </code>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="keyName">Name</Label>
                <Input
                  id="keyName"
                  placeholder="e.g. Zapier integration"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
            <DialogFooter>
              {newKey ? (
                <Button onClick={() => handleOpenChange(false)}>Done</Button>
              ) : (
                <Button
                  onClick={() => createKey.mutate({ name })}
                  disabled={!name || createKey.isPending}
                >
                  Create
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-card border-border p-0 overflow-hidden">
        {apiKeys.isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : apiKeys.data?.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">No API keys yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeys.data?.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell>
                    <Badge variant={key.revokedAt ? "destructive" : "default"}>
                      {key.revokedAt ? "Revoked" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "Never"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(key.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {!key.revokedAt && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => revokeKey.mutate({ id: key.id })}
                        disabled={revokeKey.isPending}
                      >
                        Revoke
                      </Button>
                    )}
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
