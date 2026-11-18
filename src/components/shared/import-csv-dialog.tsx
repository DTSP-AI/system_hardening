"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { parseCsv } from "@/lib/csv";
import { toast } from "sonner";

export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
}

type Step = "upload" | "map" | "preview";

export function ImportCsvDialog({
  title,
  fields,
  onImport,
  isImporting,
}: {
  title: string;
  fields: ImportField[];
  onImport: (rows: Record<string, string>[]) => Promise<void>;
  isImporting?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  function reset() {
    setStep("upload");
    setHeaders([]);
    setRows([]);
    setMapping({});
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result ?? ""));
      if (parsed.length < 1) {
        toast.error("CSV file is empty");
        return;
      }
      const [headerRow, ...dataRows] = parsed;
      setHeaders(headerRow);
      setRows(dataRows);

      const autoMap: Record<string, string> = {};
      for (const field of fields) {
        const match = headerRow.find(
          (h) =>
            h.trim().toLowerCase() === field.label.toLowerCase() ||
            h.trim().toLowerCase() === field.key.toLowerCase(),
        );
        if (match) autoMap[field.key] = match;
      }
      setMapping(autoMap);
      setStep("map");
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function buildMappedRows(): Record<string, string>[] {
    return rows.map((row) => {
      const record: Record<string, string> = {};
      for (const field of fields) {
        const header = mapping[field.key];
        if (!header) continue;
        const idx = headers.indexOf(header);
        record[field.key] = idx >= 0 ? (row[idx] ?? "").trim() : "";
      }
      return record;
    });
  }

  const requiredKeys = fields.filter((f) => f.required).map((f) => f.key);
  const mappedRows = step === "preview" ? buildMappedRows() : [];
  const validRows = mappedRows.filter((r) => requiredKeys.every((k) => r[k]));
  const skippedCount = mappedRows.length - validRows.length;
  const mappedFields = fields.filter((f) => mapping[f.key]);

  function handlePreview() {
    const missingRequired = fields.filter((f) => f.required && !mapping[f.key]);
    if (missingRequired.length > 0) {
      toast.error(
        `Map required field${missingRequired.length > 1 ? "s" : ""}: ${missingRequired
          .map((f) => f.label)
          .join(", ")}`,
      );
      return;
    }
    setStep("preview");
  }

  async function handleImport() {
    try {
      await onImport(validRows);
      setOpen(false);
      reset();
    } catch {
      // parent mutation surfaces the error via toast; keep dialog open to retry
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">Import CSV</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="flex flex-col gap-3">
            <Label htmlFor="csv-file">CSV file</Label>
            <input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:text-secondary-foreground"
            />
          </div>
        )}

        {step === "map" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Map columns from your file ({rows.length} row{rows.length === 1 ? "" : "s"} found) to
              CRM fields.
            </p>
            {fields.map((field) => (
              <div key={field.key} className="flex items-center justify-between gap-4">
                <Label className="w-40 shrink-0">
                  {field.label}
                  {field.required && <span className="text-destructive"> *</span>}
                </Label>
                <Select
                  value={mapping[field.key] ?? "__none__"}
                  onValueChange={(v) =>
                    setMapping((m) => ({ ...m, [field.key]: v === "__none__" ? "" : v }))
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Don't import" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Don&apos;t import</SelectItem>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}

        {step === "preview" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {validRows.length} row{validRows.length === 1 ? "" : "s"} ready to import
              {skippedCount > 0
                ? ` — ${skippedCount} skipped (missing a required field)`
                : ""}
              . Showing first {Math.min(5, validRows.length)}.
            </p>
            <div className="max-h-64 overflow-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {mappedFields.map((f) => (
                      <th key={f.key} className="p-2 text-left font-medium text-muted-foreground">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {validRows.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      {mappedFields.map((f) => (
                        <td key={f.key} className="p-2">
                          {row[f.key] || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "map" && (
            <Button variant="outline" onClick={() => setStep("upload")}>
              Back
            </Button>
          )}
          {step === "preview" && (
            <Button variant="outline" onClick={() => setStep("map")}>
              Back
            </Button>
          )}
          {step === "map" && <Button onClick={handlePreview}>Preview</Button>}
          {step === "preview" && (
            <Button onClick={handleImport} disabled={isImporting || validRows.length === 0}>
              Import {validRows.length} row{validRows.length === 1 ? "" : "s"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
