---
title: BOS1 hardening and agent access release record
status: active
relationships:
  governed_by: [../../CLAUDE.md]
  releases: [SPEC.md]
---

# Release record

Nothing in this record is deployed. It names what a deployment of this work consists of.

## Commits

- Base: `f62bf05` (main of DTSP-AI/system_hardening and YBRYX/BOS1 on 2026-11-19).
- Pull request 1, branch `hardening/red-fixes`, head `c2574d6`: the five audited defects, the checks and CI.
- Pull request 2, branch `active-dev`: scoped API keys, the MCP endpoint, the CLI, the review fixes, these documents.
- Both were merged into `main` of the fork on 2026-11-20 (merge commit `f74ff5e`). Neither has gone to the upstream YBRYX/BOS1; that needs Josh Phelps's approval.

## Migrations

One, in pull request 2: `prisma/migrations/20261119212317_add_api_key_scopes_and_idempotency_keys`.

- Additive: adds `api_keys.scopes` (default empty) and the table `idempotency_keys`. No existing data changes.
- Apply: `npx prisma migrate deploy` with `DATABASE_URL` pointing at the deployment's database.
- Until it is applied, the MCP endpoint and the API Keys admin panel fail; the rest of the app does not depend on it.
- Existing API keys get no scopes and so no access. That is deliberate: no key could do anything before this work.
- Rollback: `docs/hardening/rollback/20261119212317_add_api_key_scopes_and_idempotency_keys.down.sql`, tested on the local test database (down, then `migrate deploy` re-applies it, then the server tests pass).
- Who applies migrations to the production database is not established: the repository has no migrate step in its build and no deploy workflow.

## Configuration

No new environment variable is read by the app. `.env.example` now lists every variable the code reads.

- Unchanged and required: `DATABASE_URL`, the Clerk keys, the Twilio variables, `BLOB_READ_WRITE_TOKEN` or `BLOB_STORE_ID`, `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`.
- Client side only, for the CLI and agents: `BOS1_URL`, `BOS1_API_KEY`.
- Tests only: `TEST_DATABASE_URL` (optional; defaults to a local Docker Postgres).

## New dependencies

- Runtime: `mcp-handler` 2.4.0, `@modelcontextprotocol/server` 2.4.0.
- Development: `@prisma/adapter-pg` 7.8.0.
- Override: zod under `@vercel/cli-config` pinned to the root version.

## After deployment

These were not possible in the build session and remain to be done on a deployed instance:

1. Create an API key in Admin > API Keys with the Read permission.
2. `BOS1_URL=<site> BOS1_API_KEY=<key> npm run cli -- tools` lists 17 tools.
3. `npm run cli -- leads list` returns a page; the same command with a wrong key exits 2.
4. Register the endpoint in one MCP client and call one read tool and one write tool.
