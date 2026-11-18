"use client";

import { trpc } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

export type CustomFieldEntityType = "CONTACT" | "COMPANY" | "DEAL" | "POLICY" | "PROJECT";

export type CustomFieldDefinition = RouterOutputs["customFieldDefinition"]["list"][number];

export function useCustomFieldDefinitions(
  entityType: CustomFieldEntityType,
  options?: { enabled?: boolean },
) {
  const definitions = trpc.customFieldDefinition.list.useQuery(undefined, {
    enabled: options?.enabled ?? true,
  });
  return {
    definitions: (definitions.data ?? []).filter((d) => d.entityType === entityType),
    isLoading: definitions.isLoading,
  };
}

function formatCustomFieldValue(def: CustomFieldDefinition, raw: unknown): string {
  if (raw === null || raw === undefined || raw === "") return "—";
  if (def.fieldType === "BOOLEAN") return raw ? "Yes" : "No";
  if (def.fieldType === "DATE") {
    const d = new Date(raw as string);
    return Number.isNaN(d.getTime()) ? String(raw) : d.toLocaleDateString();
  }
  return String(raw);
}

export function CustomFieldsDisplay({
  entityType,
  values,
}: {
  entityType: CustomFieldEntityType;
  values: unknown;
}) {
  const { definitions, isLoading } = useCustomFieldDefinitions(entityType);
  if (isLoading || definitions.length === 0) return null;
  const data = (values ?? {}) as Record<string, unknown>;

  return (
    <>
      {definitions.map((def) => (
        <div key={def.id} className="flex flex-col gap-0.5">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {def.label}
          </span>
          <span className="text-sm text-card-foreground">
            {formatCustomFieldValue(def, data[def.key])}
          </span>
        </div>
      ))}
    </>
  );
}
