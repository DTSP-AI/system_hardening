import { z } from "zod";

export const zId = z.string().min(1).max(64);
export const zName = z.string().min(1).max(200);
export const zShort = z.string().max(200);
export const zLong = z.string().max(10_000);
export const zPhone = z.string().max(32);
export const zEmail = z.email().max(254);
export const zDomain = z.string().max(253);
export const zIdArray = z.array(zId).min(1).max(500);

// z.any() values are kept: tightening them would break existing custom-field writes.
export const zCustomFields = z
  .record(z.string().max(64), z.any())
  .refine((v) => Object.keys(v).length <= 100, { message: "Too many custom fields" })
  .refine((v) => JSON.stringify(v).length <= 16_384, { message: "Custom fields too large" });

export const zImportRows = <T extends z.ZodType>(schema: T) => z.array(schema).max(1000);
