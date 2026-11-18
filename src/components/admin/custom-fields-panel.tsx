"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type EntityType = "CONTACT" | "COMPANY" | "DEAL" | "POLICY" | "PROJECT";
type FieldType = "TEXT" | "NUMBER" | "DATE" | "SELECT" | "BOOLEAN";
type Definition = RouterOutputs["customFieldDefinition"]["list"][number];

const ENTITY_TABS: { value: EntityType; label: string }[] = [
  { value: "CONTACT", label: "Contacts" },
  { value: "COMPANY", label: "Companies" },
  { value: "DEAL", label: "Deals" },
  { value: "POLICY", label: "Policies" },
  { value: "PROJECT", label: "Projects" },
];

function DefinitionRow({ definition }: { definition: Definition }) {
  const utils = trpc.useUtils();
  const deleteDefinition = trpc.customFieldDefinition.delete.useMutation({
    onSuccess: () => {
      utils.customFieldDefinition.list.invalidate();
      toast.success("Field deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-card-foreground">{definition.label}</span>
        <span className="text-xs text-muted-foreground">{definition.key}</span>
      </div>
      <Badge variant="secondary">{definition.fieldType}</Badge>
      {definition.required && <Badge>Required</Badge>}
      {definition.fieldType === "SELECT" &&
        Array.isArray(definition.options) &&
        definition.options.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {(definition.options as string[]).join(", ")}
          </span>
        )}
      <div className="flex-1" />
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => deleteDefinition.mutate({ id: definition.id })}
        disabled={deleteDefinition.isPending}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

function NewFieldDialog({ entityType }: { entityType: EntityType }) {
  const utils = trpc.useUtils();
  const createDefinition = trpc.customFieldDefinition.create.useMutation({
    onSuccess: () => {
      utils.customFieldDefinition.list.invalidate();
      toast.success("Field added");
    },
    onError: (err) => toast.error(err.message),
  });

  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState<FieldType>("TEXT");
  const [optionsText, setOptionsText] = useState("");
  const [required, setRequired] = useState(false);

  function reset() {
    setKey("");
    setLabel("");
    setFieldType("TEXT");
    setOptionsText("");
    setRequired(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  function handleCreate() {
    createDefinition.mutate(
      {
        entityType,
        key,
        label,
        fieldType,
        required,
        options:
          fieldType === "SELECT"
            ? optionsText
                .split(",")
                .map((o) => o.trim())
                .filter(Boolean)
            : [],
      },
      { onSuccess: () => handleOpenChange(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>New Field</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New custom field</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cfLabel">Label</Label>
            <Input
              id="cfLabel"
              placeholder="e.g. Panel size"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                if (!key) {
                  setKey(
                    e.target.value
                      .trim()
                      .replace(/[^a-zA-Z0-9 ]/g, "")
                      .split(" ")
                      .filter(Boolean)
                      .map((w, i) =>
                        i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1),
                      )
                      .join(""),
                  );
                }
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cfKey">Key</Label>
            <Input id="cfKey" value={key} onChange={(e) => setKey(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Type</Label>
            <Select value={fieldType} onValueChange={(v) => setFieldType(v as FieldType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TEXT">Text</SelectItem>
                <SelectItem value="NUMBER">Number</SelectItem>
                <SelectItem value="DATE">Date</SelectItem>
                <SelectItem value="SELECT">Select</SelectItem>
                <SelectItem value="BOOLEAN">Boolean</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {fieldType === "SELECT" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cfOptions">Options (comma-separated)</Label>
              <Textarea
                id="cfOptions"
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                placeholder="Small, Medium, Large"
              />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-popover-foreground">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="size-4 rounded border-border"
            />
            Required
          </label>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={!key || !label || createDefinition.isPending}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CustomFieldsPanel() {
  const definitions = trpc.customFieldDefinition.list.useQuery();

  return (
    <Tabs defaultValue="CONTACT">
      <TabsList>
        {ENTITY_TABS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {ENTITY_TABS.map((tab) => {
        const rows = definitions.data?.filter((d) => d.entityType === tab.value) ?? [];
        return (
          <TabsContent key={tab.value} value={tab.value} className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Custom fields defined for {tab.label.toLowerCase()}.
              </p>
              <NewFieldDialog entityType={tab.value} />
            </div>
            <Card className="bg-card border-border p-0 overflow-hidden">
              {definitions.isLoading ? (
                <div className="flex flex-col gap-2 p-4">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground">
                  No custom fields yet for {tab.label.toLowerCase()}.
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {rows.map((definition) => (
                    <DefinitionRow key={definition.id} definition={definition} />
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
