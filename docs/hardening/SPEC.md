---
title: BOS1 hardening and agent access spec
status: active
relationships:
  governed_by: [../../CLAUDE.md]
  implemented_by: [ARCHITECTURE.md]
---

# BOS1 hardening and agent access

## Outcome

BOS1 enforces its deal and lead rules on every path, account attachments work, external
calls no longer run inside a database transaction, and production dependencies carry no
known high-severity vulnerability. External agents can read and safely write CRM records
through an MCP server and a CLI, authenticated by scoped API keys, under the same rules as
the web UI.

## Users

- Sales user (web UI): works leads, deals, accounts and attachments exactly as today.
- Admin (web UI): creates and revokes scoped API keys.
- External agent (MCP client or CLI): reads CRM records and performs a small set of safe writes.

## In scope

- One deal stage service used by every stage change.
- Idempotent lead conversion with an audit row.
- Account attachments accepted by the path policy, from one shared entity-type list.
- Reads run without a transaction; email send and attachment create make external calls outside one.
- Pin the nested vulnerable zod.
- API key verification with scopes, expiry, revocation, last-used stamp and a per-key rate limit.
- MCP endpoint at /api/mcp and an `npm run cli` client over it.
- Repo onboarding: declared checks, CI, a Postgres-backed server test harness, the lint fix.
- docs/HEADLESS_PLAN.md describing the shelved headless work.

## Out of scope

- UI list pagination, new indexes, CSP enforcement, custom-field validation, tRPC error formatting.
- Unifying Clerk ids and User ids with foreign keys.
- Multi-tenancy, an outbound event stream, LangGraph or any agent runtime.
- MCP tools for deletes, email, calls, bulk import and admin actions.
- Any change to the Twilio routes.

## Acceptance criteria

- A1: `npm run lint`, `npx tsc --noEmit` and `npm test` pass locally and in CI on the committed tree.
- A2: Server tests run against a local Postgres with the Prisma migrations applied, never a shared database.
- A3: A deal that has been converted to an account cannot change stage through `moveStage`, `moveStageMany` or `update`.
- A4: `deal.update` rejects or ignores a `stageId` field; a deal placed in a Won stage by create or move has status WON and a closedAt; in a Lost stage LOST; otherwise OPEN with closedAt null.
- A5: `moveStageMany` writes one audit row per deal moved.
- A6: Two concurrent `lead.convert` calls for the same lead produce exactly one contact and one deal; a repeat call returns the existing ones; conversion writes an audit row.
- A7: An attachment path for an account (`attachments/account/<id>/<uuid>.<ext>`) passes the path policy; every entity type accepted by upload is accepted by the policy.
- A8: An authed tRPC query does not open a database transaction; an authed mutation still commits its audit row atomically with its change.
- A9: `email.send` with a provider that fails or times out leaves one activity row marked failed and sends at most one message; a success leaves one row marked sent.
- A10: `attachment.create` performs its storage lookup before any transaction opens.
- A11: `npm audit --omit=dev` reports no high or critical vulnerability.
- A12: A request to /api/mcp with no key, an unknown key, a revoked key or an expired key is refused with 401.
- A13: A key with only the read scope is refused on every write tool; the refusal is enforced in code before the tool runs.
- A14: A write tool call repeated with the same idempotency key returns the first result and does not repeat its effect.
- A15: A write made through MCP appears in the audit log attributed to the API key.
- A16: MCP `move_deal_stage` and `convert_lead` obey A3 and A6 because they call the same services as the UI.
- A17: List tools return at most a bounded page and a cursor for the next page.
- A18: `npm run cli` lists leads as JSON against a running instance and exits non-zero on an auth failure.
- A19: An admin can choose scopes when creating a key; key creation and revocation write audit rows.
- A20: Every existing tRPC procedure keeps its input and output shape, except `deal.update` losing `stageId`.
- A21: docs/HEADLESS_PLAN.md exists and lists the remaining headless work by scope.

## Constraints

- Stack is fixed: Next.js 16, tRPC 11, Prisma 7 on Neon Postgres, Clerk, Twilio Voice, Vercel Blob, Resend. No new vendor.
- Single-tenant, one database per deployment (documented deviation in CLAUDE.md).
- Schema changes are new additive migration files; committed migrations are never edited.
- Work lands on `active-dev` and reaches `main` of DTSP-AI/system_hardening by pull request only. Nothing is pushed to YBRYX/BOS1.
- Authorization, idempotency and tool execution are enforced in deterministic code.
