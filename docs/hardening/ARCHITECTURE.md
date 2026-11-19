---
title: BOS1 hardening and agent access architecture
status: active
relationships:
  governed_by: [../../CLAUDE.md]
  implements: [SPEC.md]
---

# Architecture: hardening and agent access

This document covers only what this pipeline changes. The rest of BOS1 keeps its current shape.

## Components

- **Domain services** (`src/server/services/`, new). Plain functions that take a database client and an
  actor and own one business rule each. Created only for the rules this work touches:
  - `deal-stage.ts`: `statusForStage`, `changeDealStage` (one or many deals). Owns status, closedAt, the
    converted-account lock, the audit row and the owner notification.
  - `lead-convert.ts`: `convertLead`. Claims the lead with a conditional update, then creates the company,
    contact and deal, and writes the audit row. A repeat call returns the existing records.
  - `crm-read.ts`: bounded, cursor-paginated reads used by the MCP tools.
  - `crm-write.ts`: `createLead`, `logActivity` for the MCP write tools, with audit rows.
  - `idempotency.ts`: `runIdempotent(db, principal, tool, key, fn)`.
- **tRPC core** (`src/server/api/trpc.ts`). `authedProcedure` gives queries the bare client as `ctx.db` and
  wraps mutations in a transaction as today. A new `authedProcedureNoTx` is used by the two mutations that
  call an external service; they open a short transaction themselves around their own writes.
- **Machine auth** (`src/lib/auth/api-key.ts`, new). `resolveApiKey(rawKey)` hashes the key, looks it up,
  refuses revoked or expired keys, stamps `lastUsedAt`, applies a per-key rate limit and returns a principal
  `{ kind: "apiKey", id, name, scopes }`.
- **MCP route** (`src/app/api/mcp/[transport]/route.ts`, new). Streamable HTTP, built on `mcp-handler` per
  the contract file `bos1.mcp.md`. Thin wrappers over the services. Listed as a public route in `src/proxy.ts`
  because it has no Clerk session; the bearer key is its only door.
- **CLI** (`scripts/bos1-cli.ts`, new). A thin HTTP client over the MCP endpoint using `BOS1_URL` and
  `BOS1_API_KEY`. It does not open the database, so an operator or agent never needs database credentials.
- **Shared entity types** (`src/lib/entity-types.ts`, new). One list of attachable and taggable entity types.
  The upload route, attachment router, tag router and the attachment path policy all derive from it.
- **Test harness** (`tests/helpers/`, new). Starts from a local Docker Postgres, applies the Prisma
  migrations, and builds a Prisma client with the plain Postgres adapter.

Deliberately not built: a service layer for the other routers, an event stream, an agent runtime, OAuth for
MCP, UI pagination.

## Data

One additive migration:

- `api_keys.scopes text[] not null default '{}'`. Existing keys get no scopes and therefore no access.
- `idempotency_keys (id, principal, tool, key, response jsonb, created_at)`, unique on `(principal, tool, key)`.

Owners of state:

| State | Owner |
|---|---|
| Deal stage, status, closedAt | `deal-stage.ts` |
| Lead conversion status and links | `lead-convert.ts` |
| API key validity and scopes | `api_keys` table, read only through `resolveApiKey` |
| Idempotent results | `idempotency_keys` table, through `runIdempotent` |
| Email delivery state | the EMAIL activity's `metadata.status` (`sending`, `sent`, `failed`) |

Actor ids: a UI write records the Clerk user id as today. An agent write records `apikey:<id>` in
`AuditLog.actorId` and `Activity.authorId`.

## Interfaces

- tRPC: every procedure keeps its input and output, except `deal.update`, which no longer accepts `stageId`.
- MCP tools (prefix `bos1_`), envelope dtsp-v1:
  - read scope: `search`, `list_leads`, `get_lead`, `list_deals`, `get_deal`, `list_contacts`, `get_contact`,
    `list_companies`, `get_company`, `list_accounts`, `get_account`, `list_pipeline_stages`, `list_activities`.
    Lists take `limit` (max 100) and `cursor`, and return `nextCursor`.
  - write scope, `idempotencyKey` required: `create_lead`, `log_activity` (NOTE or TASK only),
    `move_deal_stage`, `convert_lead`.
- Auth: `Authorization: Bearer bos1_...`. No key, unknown, revoked or expired gives 401. A write tool called
  with a read-only key returns the `forbidden` error before the service runs.
- CLI: `npm run cli -- <command> [--json]`; exit code 0 on success, 1 on tool error, 2 on auth or transport error.

## Risks

- **Upstream drift.** The client commits to YBRYX/BOS1 main often. Mitigation: sync from upstream before each
  pull request; services are new files, so conflicts are limited to the routers touched.
- **Production migration path is not known.** The repository has no migrate script and no CI. The migration
  is additive and safe to apply with `prisma migrate deploy`, but who runs it against the Neon database is
  not established. Until it is applied, the MCP endpoint and key scopes do not work in production; the UI
  fixes do not depend on it.
- **Email state change.** EMAIL activities gain `metadata.status`. Rows written before this change have no
  status and are treated as sent.
- **Neon adapter in tests.** Tests use the plain Postgres adapter, so adapter-specific behavior is not
  covered by them. Mitigated by keeping services adapter-neutral (they receive the client).
- **mcp-handler version.** Package facts were checked 2026-10-09 in the MCP skill's reference; the exact
  version is re-checked against the registry when the dependency is added.
- **Public repository.** The fork is public, so the agent auth design is readable by anyone. Security does
  not depend on it being secret, but visibility is the owner's decision.
