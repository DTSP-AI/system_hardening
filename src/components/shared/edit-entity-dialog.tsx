"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCustomFieldDefinitions,
  type CustomFieldEntityType,
} from "@/components/shared/custom-fields";

export type EditFieldType = "text" | "textarea" | "select" | "number" | "date" | "boolean";

export interface EditFieldSchema {
  name: string;
  label: string;
  type: EditFieldType;
  options?: { value: string; label: string }[];
  required?: boolean;
}

function toInputValue(value: unknown, type: EditFieldType): string {
  if (value === null || value === undefined) return "";
  if (type === "date") {
    const d = new Date(value as string | number | Date);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  }
  return String(value);
}

export interface EditEntityCustomFields {
  entityType: CustomFieldEntityType;
  values: unknown;
}

export function EditEntityDialog({
  title,
  fields,
  values,
  onSave,
  isSaving,
  trigger,
  customFields,
}: {
  title: string;
  fields: EditFieldSchema[];
  values: Record<string, unknown>;
  onSave: (data: Record<string, string | number | undefined | Record<string, unknown>>) => void;
  isSaving?: boolean;
  trigger?: React.ReactNode;
  customFields?: EditEntityCustomFields;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [customForm, setCustomForm] = useState<Record<string, string>>({});

  const { definitions: customFieldDefs } = useCustomFieldDefinitions(
    customFields?.entityType ?? "CONTACT",
    { enabled: !!customFields },
  );

  function handleOpenChange(next: boolean) {
    if (next) {
      setForm(
        Object.fromEntries(fields.map((f) => [f.name, toInputValue(values[f.name], f.type)])),
      );
      const currentCustomValues = (customFields?.values ?? {}) as Record<string, unknown>;
      setCustomForm(
        Object.fromEntries(
          customFieldDefs.map((def) => [
            def.key,
            def.fieldType === "BOOLEAN"
              ? currentCustomValues[def.key]
                ? "true"
                : "false"
              : toInputValue(currentCustomValues[def.key], def.fieldType === "DATE" ? "date" : "text"),
          ]),
        ),
      );
    }
    setOpen(next);
  }

  function handleSave() {
    const data: Record<string, string | number | undefined | Record<string, unknown>> = {};
    for (const field of fields) {
      const raw = form[field.name] ?? "";
      data[field.name] = raw === "" ? undefined : field.type === "number" ? Number(raw) : raw;
    }

    if (customFields) {
      const merged = { ...((customFields.values ?? {}) as Record<string, unknown>) };
      for (const def of customFieldDefs) {
        const raw = customForm[def.key] ?? "";
        if (def.fieldType === "BOOLEAN") {
          merged[def.key] = raw === "true";
        } else if (raw === "") {
          delete merged[def.key];
        } else if (def.fieldType === "NUMBER") {
          merged[def.key] = Number(raw);
        } else {
          merged[def.key] = raw;
        }
      }
      data.customFields = merged;
    }

    onSave(data);
    setOpen(false);
  }

  const canSave = fields.every((f) => !f.required || form[f.name]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="icon-sm" variant="outline">
            <Pencil className="size-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {fields.map((field) => (
            <div key={field.name} className="flex flex-col gap-1.5">
              <Label htmlFor={field.name}>{field.label}</Label>
              {field.type === "textarea" ? (
                <Textarea
                  id={field.name}
                  value={form[field.name] ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [field.name]: e.target.value }))}
                />
              ) : field.type === "select" ? (
                <Select
                  value={form[field.name] ?? ""}
                  onValueChange={(v) => setForm((f) => ({ ...f, [field.name]: v }))}
                >
                  <SelectTrigger id={field.name} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : field.type === "boolean" ? (
                <Checkbox
                  id={field.name}
                  checked={form[field.name] === "true"}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, [field.name]: checked ? "true" : "false" }))
                  }
                />
              ) : (
                <Input
                  id={field.name}
                  type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                  value={form[field.name] ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [field.name]: e.target.value }))}
                />
              )}
            </div>
          ))}
          {customFieldDefs.map((def) => (
            <div key={def.id} className="flex flex-col gap-1.5">
              <Label htmlFor={`cf-${def.key}`}>{def.label}</Label>
              {def.fieldType === "SELECT" ? (
                <Select
                  value={customForm[def.key] ?? ""}
                  onValueChange={(v) => setCustomForm((f) => ({ ...f, [def.key]: v }))}
                >
                  <SelectTrigger id={`cf-${def.key}`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(def.options as string[]).map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : def.fieldType === "BOOLEAN" ? (
                <Checkbox
                  id={`cf-${def.key}`}
                  checked={customForm[def.key] === "true"}
                  onCheckedChange={(checked) =>
                    setCustomForm((f) => ({ ...f, [def.key]: checked ? "true" : "false" }))
                  }
                />
              ) : (
                <Input
                  id={`cf-${def.key}`}
                  type={def.fieldType === "NUMBER" ? "number" : def.fieldType === "DATE" ? "date" : "text"}
                  value={customForm[def.key] ?? ""}
                  onChange={(e) => setCustomForm((f) => ({ ...f, [def.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={isSaving || !canSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
