@AGENTS.md

## Deviations from global laws

- Law 4 (RLS on every tenant-scoped model; tenant procedures) does not apply: BOS1 is a single-tenant deployment, one DB per deployment, no tenant-scoped models. `authedProcedure` (allowlisted, active User) is the stricter gated procedure and `adminProcedure` gates admin. Re-introducing multi-tenancy reinstates RLS and tenant scoping.
