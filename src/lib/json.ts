import { Prisma } from "@generated/prisma/client";

/**
 * JSON text for machine clients. Money columns (Prisma Decimal, 12,2) go out
 * as numbers, not strings; dates as ISO strings.
 */
export function toMachineJsonText(value: unknown, indent?: number): string {
  return JSON.stringify(
    value,
    function (this: Record<string, unknown>, key: string, json: unknown) {
      const raw = this[key];
      return raw instanceof Prisma.Decimal ? raw.toNumber() : json;
    },
    indent,
  );
}

/** The same conversion as a plain JSON value, for storing in a Json column. */
export function toMachineJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(toMachineJsonText(value));
}
