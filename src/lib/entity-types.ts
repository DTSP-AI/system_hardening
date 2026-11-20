/**
 * The record types that can carry attachments and tags. The one list: the
 * upload route, the attachment and tag routers, the attachment path policy and
 * the UI all derive from it. Matches the Prisma enum TaggableEntityType.
 * Client-safe: no server imports.
 */
export const ENTITY_TYPES = ["CONTACT", "COMPANY", "DEAL", "LEAD", "ACCOUNT"] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];
