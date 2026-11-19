---
id: bos1-headless-plan
title: BOS1 headless CRM plan (shelved)
version: 1.0.0
status: shelved
scope: project (this repository)
last_updated: 2026-11-19
relationships:
  governed_by:
    type: defers_to
    targets: [../CLAUDE.md]
    inbound: []
  builds_on:
    type: expands
    targets: [hardening/ARCHITECTURE.md, ../bos1.mcp.md]
    inbound: []
---

# BOS1 headless CRM plan (shelved)

Status: shelved on 2026-11-19. Nothing here is being built. This records what remains between
BOS1 as it stands after the hardening work and a headless CRM, so the work can be picked up
without a new audit.

"Headless" means the data and the business rules are reachable through an API, tools and
events, and the web UI is one client among several (agents, MCP clients, the CLI, voice).

## Where BOS1 stands

Done in the hardening work (see hardening/SPEC.md):

- Business rules for deal stages and lead conversion live in `src/server/services/` and are
  shared by the UI and the MCP tools.
- Machine identity exists: hashed API keys with read and write scopes, verified per request.
- An MCP endpoint (`/api/mcp`, 17 tools) and a CLI over it. Contract: `bos1.mcp.md`.
- Writes by agents are idempotent and audited under the API key.
- Reads no longer open a transaction, failed mutations roll back, and external calls run
  outside transactions.

## Open decision that comes first

**Single-tenant or multi-tenant.** BOS1 is one deployment and one database per customer.
A headless CRM sold as one product to many customers needs either a tenant id on every row
with Postgres row-level security, or automated provisioning of one deployment per customer.
This changes the schema and every query, so it is decided before items 1 to 6 are built on
single-tenant assumptions. Owner of the decision: Pete, with Josh.

## Remaining work, in order

### 1. Service layer for every router

- Today: rules for deals and leads are in services; the other routers (contact, company,
  account, activity, tag, todo, notification, pipeline stage, custom fields) still hold their
  logic inline.
- Scope: about 15 router files become thin wrappers; about 8 service modules.
- Done when: no router or tool writes to the database except through a service, and each
  service has tests against the test database.

### 2. One identity for people and machines

- Today: `ownerId`, `authorId`, `actorId`, `uploadedById` and `Notification.userId` hold Clerk
  user ids with no foreign key; rate-limit keys use `User.id`; agent writes use `apikey:<id>`.
- Scope: one migration with a backfill; an `actors` reference or a typed actor column; every
  service takes an actor object instead of a string.
- Done when: every authorship column joins to a user or an API key, and unlinking a user
  cannot orphan rows.

### 3. Full read and write coverage for agents

- Today: 13 read tools and 4 write tools. No updates, no deletes, no email, no calls, no
  attachments, no admin actions.
- Scope: update tools for each record type; email send behind human approval; tag tools.
  Deletes and admin actions stay out until item 2 is done.
- Done when: each new tool is in `bos1.mcp.md`, passes the contract check, and has a denied-call
  test and a replay test.

### 4. Outbound events

- Today: nothing announces a change. An agent has to poll.
- Scope: an outbox table written in the same transaction as the change; a delivery worker;
  signed webhooks with retries; events for lead created, lead converted, deal stage changed,
  call recorded, email failed.
- Constraint: Vercel functions are not a place for a long-running worker. This item needs a
  hosting decision (a scheduled function, or a persistent worker on a host not yet in the
  stack, which is asked about first).
- Done when: a subscriber receives each event at least once, in order per record, and a
  failed delivery is retried and visible.

### 5. List endpoints and indexes for volume

- Today: the UI's list queries (`lead.list`, `deal.list`, `contact.list`, `company.list`,
  `account.list`, `activity.myTasks`) load whole tables; `dashboard.summary` sums in memory;
  call lookups filter on JSON fields with no index.
- Scope: cursor pagination in those procedures and their pages; SQL aggregates for the
  dashboard; one migration adding indexes on `deals(status, createdAt)`, `deals(contactId)`,
  `deals(companyId)`, `leads(status, createdAt)`, `activities(authorId, type, createdAt)`,
  `companies(name)`, and real columns for `parentCallSid` and `recordingSid`.
- Done when: no query returns an unbounded result set, verified with a seeded large dataset.

### 6. Agent runtime

- Today: none. BOS1 has no model calls.
- Scope: a LangGraph runtime that uses the MCP tools as its only way into the CRM. First
  agents by value: call summaries from recordings, lead enrichment and scoring, stale-deal
  follow-up, a read-only copilot, email drafting with approval.
- Decision needed: TypeScript LangGraph beside the CRM, or the existing Python backend
  (`Ybryx-sys-backend`) rewired from its retired CRM integration to these MCP tools. That
  backend has not been run or tested in this work.
- Done when: graph routing and termination are tested, checkpoints survive a restart, a
  denied tool call is tested, and a replayed request repeats no side effect.

## Other findings left open by the audit

These are independent of the headless work and can be done at any time:

- Custom field values are not validated against their definitions on the server.
- Tags and attachments are not removed when their record is deleted (no foreign key).
- A pipeline stage can be marked both Won and Lost.
- No audit rows for bulk import, tag and stage admin changes, or activity create and delete.
- The Content-Security-Policy is report-only.
- tRPC returns internal error messages to the browser (no error formatter).
- `activity.create` accepts CALL and EMAIL, so call and email history can be entered by hand.
- The prospecting search returns generated sample data.
- `voice/announce` does not handle a missing Twilio token the way the other Twilio routes do.
