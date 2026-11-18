"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toCsv, downloadCsv, type CsvColumn } from "@/lib/csv";

export function ExportCsvButton<T>({
  data,
  columns,
  filename,
}: {
  data: T[] | undefined;
  columns: CsvColumn<T>[];
  filename: string;
}) {
  function handleExport() {
    if (!data || data.length === 0) return;
    downloadCsv(filename, toCsv(data, columns));
  }

  return (
    <Button variant="outline" onClick={handleExport} disabled={!data || data.length === 0}>
      <Download className="size-4" />
      Export CSV
    </Button>
  );
}
