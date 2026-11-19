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
import { Checkbox } from "@/components/ui/checkbox";
import type { ApiKeyScope } from "@/lib/auth/api-key-scopes";

const SCOPE_OPTIONS: Array<{ scope: ApiKeyScope; label: string; hint: string }> = [
  { scope: "read", label: "Read", hint: "Search and view leads, deals, contacts, companies and accounts." },
  { scope: "write", label: "Write", hint: "Create leads, log notes and tasks, move deals, convert leads. Includes read." },
];

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
  const [scopes, setScopes] = useState<ApiKeyScope[]>(["read"]);
  const [newKey, setNewKey] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setName("");
      setScopes(["read"]);
      setNewKey(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Keys let external agents and integrations use this workspace through the MCP endpoint and CLI.
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
                <fieldset className="mt-3 flex flex-col gap-2">
                  <legend className="mb-1 text-sm font-medium">Permissions</legend>
                  {SCOPE_OPTIONS.map((option) => (
                    <label key={option.scope} className="flex items-start gap-2 text-sm">
                      <Checkbox
                        className="mt-0.5"
                        checked={scopes.includes(option.scope)}
                        onCheckedChange={(checked) =>
                          setScopes((current) =>
                            checked === true
                              ? [...new Set([...current, option.scope])]
                              : current.filter((s) => s !== option.scope),
                          )
                        }
                      />
                      <span>
                        <span className="font-medium">{option.label}</span>
                        <span className="block text-muted-foreground">{option.hint}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              </div>
            )}
            <DialogFooter>
              {newKey ? (
                <Button onClick={() => handleOpenChange(false)}>Done</Button>
              ) : (
                <Button
                  onClick={() => createKey.mutate({ name, scopes })}
                  disabled={!name || scopes.length === 0 || createKey.isPending}
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
                <TableHead>Permissions</TableHead>
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
                  <TableCell className="text-muted-foreground">
                    {key.scopes.length > 0 ? key.scopes.join(", ") : "None"}
                  </TableCell>
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
