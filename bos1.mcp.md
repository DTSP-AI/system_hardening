---
name: bos1-crm
version: 1.0.0
app: bos1
transport: streamable-http
endpoint: /api/mcp
runtime: nextjs-vercel
envelope: dtsp-v1
auth:
  mode: jwt
  scopes:
    bos1:read: { claim: scope=read }
    bos1:write: { claim: scope=write, includes: [bos1:read] }
env: [DATABASE_URL]
tools:
  - { name: bos1_search_records, scope: bos1:read, readOnly: true, destructive: false, idempotent: true, openWorld: false, errors: [forbidden, validation_error] }
  - { name: bos1_list_leads, scope: bos1:read, readOnly: true, destructive: false, idempotent: true, openWorld: false, errors: [forbidden, validation_error] }
  - { name: bos1_get_lead, scope: bos1:read, readOnly: true, destructive: false, idempotent: true, openWorld: false, errors: [forbidden, not_found] }
  - { name: bos1_list_deals, scope: bos1:read, readOnly: true, destructive: false, idempotent: true, openWorld: false, errors: [forbidden, validation_error] }
  - { name: bos1_get_deal, scope: bos1:read, readOnly: true, destructive: false, idempotent: true, openWorld: false, errors: [forbidden, not_found] }
  - { name: bos1_list_contacts, scope: bos1:read, readOnly: true, destructive: false, idempotent: true, openWorld: false, errors: [forbidden, validation_error] }
  - { name: bos1_get_contact, scope: bos1:read, readOnly: true, destructive: false, idempotent: true, openWorld: false, errors: [forbidden, not_found] }
  - { name: bos1_list_companies, scope: bos1:read, readOnly: true, destructive: false, idempotent: true, openWorld: false, errors: [forbidden, validation_error] }
  - { name: bos1_get_company, scope: bos1:read, readOnly: true, destructive: false, idempotent: true, openWorld: false, errors: [forbidden, not_found] }
  - { name: bos1_list_accounts, scope: bos1:read, readOnly: true, destructive: false, idempotent: true, openWorld: false, errors: [forbidden, validation_error] }
  - { name: bos1_get_account, scope: bos1:read, readOnly: true, destructive: false, idempotent: true, openWorld: false, errors: [forbidden, not_found] }
  - { name: bos1_list_pipeline_stages, scope: bos1:read, readOnly: true, destructive: false, idempotent: true, openWorld: false, errors: [forbidden] }
  - { name: bos1_list_activities, scope: bos1:read, readOnly: true, destructive: false, idempotent: true, openWorld: false, errors: [forbidden, validation_error] }
clients: [claude-code]
cli: none
relationships:
  governed_by: [CLAUDE.md]
  implemented_by: [src/app/api/mcp/route.ts]
---

# bos1-crm MCP Contract

BOS1 is a single-tenant CRM: leads, deals, contacts, companies, accounts and their activity
timelines. This surface lets an external agent read those records and make a small set of
safe changes, under the same business rules as the web UI. Every tool is a thin wrapper over
`src/server/services/`.

Frontmatter is checked against `src/app/api/mcp/route.ts` by
`ricks-higherdimensional-mcp-machine/scripts/check_contract.py`.

## Authentication

Send a BOS1 API key as `Authorization: Bearer bos1_...`. An admin creates keys in
Admin > API Keys and chooses their permissions. The key is checked against the database on
every request: an unknown, revoked or expired key, or a key with no permissions, gets
HTTP 401. A key over its rate limit gets 429 with `Retry-After`.

| Permission | Scope | Allows |
|---|---|---|
| Read | `bos1:read` | Every search, list and get tool |
| Write | `bos1:write` | Every write tool. Includes Read. |

The frontmatter declares `auth.mode: jwt` because the contract format has no API-key mode
yet. The credential is an opaque key resolved to a principal with scopes, not a JWT; the
`claim` entries name the scope stored on the key.

## Pagination

Every `list` tool takes `limit` (1-100, default 25) and `cursor`, and returns
`{ "items": [...], "nextCursor": "<id>" | null }`. Pass `nextCursor` back as `cursor` for the
next page. `null` means the last page. Rows are ordered newest first.

## Tools

### bos1_search_records

Search contacts, companies, deals and leads by name (contacts also by email). Up to five matches per type.

| Name | Type | Required | Description |
|------|------|----------|-------------|
| query | string | Yes | 1-100 characters, case-insensitive substring |

**Returns:** `{ "success": true, "data": { "contacts": [...], "companies": [...], "deals": [...], "leads": [...] } }`

### bos1_list_leads

List leads, newest first.

| Name | Type | Required | Description |
|------|------|----------|-------------|
| limit | int | No | 1-100. Default 25 |
| cursor | string | No | `nextCursor` from the previous page |
| status | string | No | NEW, CONTACTED, QUALIFIED, UNQUALIFIED or CONVERTED |

**Returns:** `{ "success": true, "data": { "items": [...], "nextCursor": null } }`

### bos1_get_lead

Fetch one lead by id. A converted lead carries `convertedContactId` and `convertedDealId`.

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | Lead id |

**Errors:** not_found

### bos1_list_deals

List deals, newest first, each with its pipeline stage. `amount` is a number.

| Name | Type | Required | Description |
|------|------|----------|-------------|
| limit | int | No | 1-100. Default 25 |
| cursor | string | No | `nextCursor` from the previous page |
| status | string | No | OPEN, WON or LOST |
| stageId | string | No | Only deals in this stage |

### bos1_get_deal

Fetch one deal by id with its stage, contact, company and, if it was converted, its account id.

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | Deal id |

**Errors:** not_found

### bos1_list_contacts

List contacts, newest first.

| Name | Type | Required | Description |
|------|------|----------|-------------|
| limit | int | No | 1-100. Default 25 |
| cursor | string | No | `nextCursor` from the previous page |
| companyId | string | No | Only contacts at this company |

### bos1_get_contact

Fetch one contact by id with its company.

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | Contact id |

**Errors:** not_found

### bos1_list_companies

List companies, newest first.

| Name | Type | Required | Description |
|------|------|----------|-------------|
| limit | int | No | 1-100. Default 25 |
| cursor | string | No | `nextCursor` from the previous page |

### bos1_get_company

Fetch one company by id.

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | Company id |

**Errors:** not_found

### bos1_list_accounts

List accounts (won deals that became customers), newest first.

| Name | Type | Required | Description |
|------|------|----------|-------------|
| limit | int | No | 1-100. Default 25 |
| cursor | string | No | `nextCursor` from the previous page |
| status | string | No | ACTIVE or CHURNED |

### bos1_get_account

Fetch one account by id with its company, contact and source deal.

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | Account id |

**Errors:** not_found

### bos1_list_pipeline_stages

List the deal pipeline stages in order. `isWon` and `isLost` mark the closing stages.

**Returns:** `{ "success": true, "data": { "items": [{ "id": "...", "name": "Qualified", "sortOrder": 0, "isWon": false, "isLost": false }] } }`

### bos1_list_activities

List the activity timeline of one record, newest first: notes, tasks, calls, emails and meetings.

| Name | Type | Required | Description |
|------|------|----------|-------------|
| entityType | string | Yes | CONTACT, DEAL, LEAD or ACCOUNT |
| entityId | string | Yes | Id of that record |
| limit | int | No | 1-100. Default 25 |
| cursor | string | No | `nextCursor` from the previous page |

## Not available through this surface

Deleting records, sending email, placing calls, bulk import, attachments and every admin
action (keys, pipeline stages, custom fields, tags). These stay in the web UI.

## Error Response Format

```json
{ "success": false, "error": { "code": "forbidden | not_found | validation_error | conflict | internal", "message": "...", "suggestion": "..." } }
```

The MCP result is flagged `isError: true`. `internal` never carries internal detail; the
server logs it.
