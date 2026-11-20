---
title: BOS1 hardening and agent access handoff
status: active
relationships:
  governed_by: [../../CLAUDE.md]
  hands_off: [SPEC.md, ARCHITECTURE.md, REVIEW.md, RELEASE.md]
---

# Handoff

Written 2026-11-19. State: built, reviewed, pushed, waiting for Josh Phelps's approval.
Nothing is merged into `main`, nothing is deployed, no shared database was touched.

## What was built

Against docs/hardening/SPEC.md, acceptance criteria A1 to A21:

| Criteria | What | Where |
|---|---|---|
| A1, A2 | Declared checks, CI, a local Postgres test harness | CLAUDE.md, .github/workflows/ci.yml, scripts/test-db.ts, tests/helpers/ |
| A3, A4, A5 | One deal stage service; conversion to an account in the same service | src/server/services/deal-stage.ts |
| A6 | Idempotent, audited lead conversion; converted status is final | src/server/services/lead-convert.ts |
| A7 | One shared entity-type list; account attachments accepted | src/lib/entity-types.ts, src/lib/attachments/file-policy.ts |
| A8, A9, A10 | Queries without transactions, mutations that roll back, external calls outside transactions | src/server/api/trpc.ts, src/server/services/email-send.ts, attachments.ts |
| A11 | zod advisory removed | package.json `overrides` |
| A12, A19 | API keys verified with scopes, expiry, revocation, rate limit, audit; scope picker | src/lib/auth/api-key.ts, src/server/api/routers/apiKey.ts, src/components/admin/api-keys-panel.tsx |
| A13 to A17 | MCP endpoint, 13 read and 4 write tools, idempotency | src/app/api/mcp/route.ts, src/server/mcp/, src/server/services/crm-read.ts, crm-write.ts, idempotency.ts, bos1.mcp.md |
| A18 | CLI over the MCP endpoint | scripts/bos1-cli.ts, scripts/bos1-cli-lib.ts |
| A20 | Existing tRPC shapes kept, with the three exceptions the spec names | |
| A21 | Shelved headless plan | docs/HEADLESS_PLAN.md |

Found and fixed along the way, not in the original audit: a failed mutation used to commit
its partial writes, because tRPC returns a failed procedure to middleware instead of throwing.

## How to run it

- Install: `npm ci`
- Checks: `npm run typecheck`, `npm run lint`, `npm test`. The tests need Docker running; they
  start a throwaway Postgres container named `bos1-test-pg` on port 54329.
- App: `npm run dev`, with the variables in `.env.example` set.
- CLI: `BOS1_URL=<site> BOS1_API_KEY=<key> npm run cli -- help`
- MCP contract check: `py -3.13 -I -X utf8 ~/.claude/skills/ricks-higherdimensional-mcp-machine/scripts/check_contract.py bos1.mcp.md --code src/app/api/mcp/route.ts`

## Last check results

On commit `72cdbd7` (branch `active-dev`), 2026-11-19:

- `npm run typecheck`: pass
- `npm run lint`: pass, no errors or warnings
- `npm test`: 115 of 115 pass (40 unit, 75 server)
- `npm audit --omit=dev`: 0 vulnerabilities
- `npm run build`: pass
- Contract check: 17 tools, route matches the contract
- CI on pull request 1 (`c2574d6`): pass

Not verified:

- The app was not run against real services. `next start` returns 500 on every route without
  Clerk keys, and none were available. The MCP endpoint is proven by tests that call its real
  route handler in-process, not over live HTTP.
- The UI changes (lead status option, scope picker, email badges) were not exercised in a browser.
- The migration was applied only to the local test database.
- Behavior on Neon, Resend, Vercel Blob and Twilio was not exercised.

## Decisions

All reversible. From `forge.py decisions`:

- F-001 Scope: onboard, the five defects, MCP and CLI, shelve headless. Pete approved the plan.
- F-002 Stack kept as is; no new vendor; test database is local Docker Postgres.
- F-003 Tier: enterprise.
- F-004 Work on `active-dev`; pull requests into `main` of DTSP-AI/system_hardening; never push to YBRYX/BOS1.
- F-005 Business rules for the touched paths live in `src/server/services/`.
- F-006 Queries use the bare client; mutations keep a transaction; email and attachments manage their own.
- F-007 MCP auth is database-backed hashed keys with scopes, not two fixed tokens.
- F-008 The CLI calls the MCP endpoint over HTTP, so nobody needs database credentials.
- F-009 Server tests use a local Postgres through `@prisma/adapter-pg`.
- F-010 Josh Phelps approves every pull request before merge; a session never merges into `main`.
- F-011, F-012 Two slices closed without a test change (a dependency pin and a document).

## What is left

Waiting on people:

1. Josh reviews and merges pull request 1, then pull request 2.
2. Someone with access applies the migration to the production database (see RELEASE.md). Who
   does that, and how, is not established.
3. The repository is public. Whether it should be is the owner's call.

After deployment, from RELEASE.md: create a key, run the CLI against the site, register the
endpoint in one MCP client and call one read tool and one write tool.

Open from the review (REVIEW.md), none blocking:

- No UI field for a key's expiry.
- No throttle on unknown-key lookups, and rejected keys are not audited.
- `idempotency_keys` is never pruned.
- The MCP contract declares `auth.mode: jwt` because the contract checker has no API-key mode.

Everything else is in docs/HEADLESS_PLAN.md.

## Smallest next step

Josh opens https://github.com/DTSP-AI/system_hardening/pull/1 and reviews it.
