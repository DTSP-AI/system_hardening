---
id: bos1-claude-md
title: BOS1 CRM engineering contract
version: 1.0.0
status: active
scope: project (this repository)
last_updated: 2026-11-19
relationships:
  harness:
    type: defers_to
    targets: ["~/.claude/CLAUDE.md", "~/.dtsp-engineering/ENGINEERING.md"]
    inbound: []
  framework_rules:
    type: imports
    targets: [AGENTS.md]
    inbound: []
  hardening_spec:
    type: points_to
    targets: [docs/hardening/SPEC.md, docs/hardening/ARCHITECTURE.md]
    inbound: [docs/hardening/SPEC.md, docs/hardening/ARCHITECTURE.md]
  generated_graph:
    type: points_to
    targets: [docs/GRAPH.yaml]
    inbound: []
project: bos1
summary: Single-tenant CRM (leads, deals, accounts, contacts, companies, activities) with a Twilio softphone, attachments
  and email, for one sales team per deployment.
repo: https://github.com/DTSP-AI/system_hardening
upstream: https://github.com/YBRYX/BOS1
branches:
  work: active-dev
  release: main
  release_merge: josh
  rule: Work on active-dev, pull request into main of DTSP-AI/system_hardening. Josh Phelps approves every pull request
    before it is merged into main; a session opens the pull request and never merges it. Nothing is pushed to the
    upstream YBRYX/BOS1.
stack:
  app: Next.js 16.4 App Router + React 19.2 + TypeScript 5 (strict) + Tailwind v4 + Radix
  api: tRPC 11 + zod 4
  data: Prisma 7 on Neon Postgres (one database per deployment)
  auth: Clerk (browser sessions) + hashed API keys (machine access)
  providers: Twilio Voice, Vercel Blob, Resend
  hosting: Vercel
  test_db: local Docker Postgres, tests only
  changes: A vendor absent from this block is undecided, not banned. Ask before adding one.
verify:
  typecheck: npm run typecheck
  lint: npm run lint
  test: npm test
  test_first: block
migrations:
  dir: prisma/migrations
  apply: npx prisma migrate deploy
  backup: pg_dump "$DATABASE_URL" --data-only --file backup-data.sql
graph:
  state: proposed
  owner: This file owns the module graph. File-level facts are generated into docs/GRAPH.yaml.
  nodes:
    ui: src/app/(app)/
    components: src/components/
    trpc_route: src/app/api/trpc/
    routers: src/server/api/routers/
    trpc_core: src/server/api/trpc.ts
    services: src/server/services/
    mcp_route: src/app/api/mcp/
    machine_auth: src/lib/auth/api-key.ts
    user_auth: src/lib/auth/app-user.ts
    twilio_routes: src/app/api/twilio/
    attachment_routes: src/app/api/attachments/
    lib: src/lib/
    db: src/lib/db.ts
    schema: prisma/
    cli: scripts/bos1-cli.ts
    tests: tests/
  edges:
  - [ui, calls, trpc_route]
  - [trpc_route, calls, routers]
  - [routers, calls, trpc_core]
  - [routers, calls, services]
  - [mcp_route, calls, services]
  - [mcp_route, calls, machine_auth]
  - [trpc_core, calls, user_auth]
  - [services, persists, db]
  - [routers, persists, db]
  - [db, reads, schema]
  - [cli, calls, mcp_route]
  - [twilio_routes, persists, db]
  - [attachment_routes, calls, user_auth]
---

@AGENTS.md

# BOS1 CRM

The map of this repository is in this file's frontmatter (`stack`, `verify`, `migrations`, `graph`). Read it
with the Read tool before the first edit; it is not loaded into the session. The generated file-level graph
is docs/GRAPH.yaml.

## Hard rules

- Branches: work on `active-dev`. `main` changes only by pull request in DTSP-AI/system_hardening, and only after
  Josh Phelps has approved it (Pete, 2026-11-19). A session opens the pull request and stops; it never merges
  into `main`. Never push to the upstream YBRYX/BOS1.
- Checks before any push: `npm run typecheck`, `npm run lint`, `npm test`.
- Tests never use a shared or production database. Server tests run against the local Docker Postgres.
- Schema changes are new migration files under prisma/migrations. Committed migrations are never edited.
- Business rules live in src/server/services/. tRPC routers and MCP tools call a service; neither repeats a rule
  nor writes it inline. Deal stage changes go through the deal stage service only.
- MCP tools never call Prisma directly, and every write tool checks the write scope and an idempotency key in code.
- External calls (Resend, Vercel Blob, Twilio) are never made inside a database transaction.
- No vendor is forbidden by decision in this project. A vendor not in the `stack` block is asked about first.

## Deviations from global laws

- Law 4 (RLS on every tenant-scoped model; tenant procedures) does not apply: BOS1 is a single-tenant deployment, one DB per deployment, no tenant-scoped models. `authedProcedure` (allowlisted, active User) is the stricter gated procedure and `adminProcedure` gates admin. Re-introducing multi-tenancy reinstates RLS and tenant scoping.
