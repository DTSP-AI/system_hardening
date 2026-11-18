// Insurance features (Policies, Renewals, Carriers, Commissions, Claims) are
// specific to the Foundry Protects tenant, not the generic YBRYX COMMAND
// workspace. Client- and server-safe (no prisma import) so both the sidebar
// nav and server-rendered pages can gate on it from a Clerk org slug.
const INSURANCE_ORG_SLUG_PREFIX = "foundry-protects";

export function isInsuranceOrgSlug(orgSlug: string | null | undefined): boolean {
  return orgSlug?.startsWith(INSURANCE_ORG_SLUG_PREFIX) ?? false;
}

// Solar features (Projects, Vendors, Commissions, Service Tickets) are
// specific to the Haven Home Solutions tenant.
const SOLAR_ORG_SLUG_PREFIX = "haven-home-solutions";

export function isSolarOrgSlug(orgSlug: string | null | undefined): boolean {
  return orgSlug?.startsWith(SOLAR_ORG_SLUG_PREFIX) ?? false;
}

// The "Signal" theme (real YBRYX brand photo backdrop, animated circuit-trace
// light nodes, deep-navy glass cards) is exclusive to the internal YBRYX
// COMMAND workspace. Every other tenant keeps the default Arctic Custom theme.
const YBRYX_ORG_SLUG_PREFIX = "ybryx-command";

export function isYbryxOrgSlug(orgSlug: string | null | undefined): boolean {
  return orgSlug?.startsWith(YBRYX_ORG_SLUG_PREFIX) ?? false;
}
