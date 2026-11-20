---
title: BOS1 hardening and agent access review
status: active
relationships:
  governed_by: [../../CLAUDE.md]
  reviews: [SPEC.md]
---

# Independent review

Reviewer: a separate security-review agent that did not write the code, given the diff
`f62bf05..6b4e4ee`, SPEC.md, ARCHITECTURE.md and bos1.mcp.md. Read-only; it ran nothing.
Date: 2026-11-19. Fixes below were made after the review and are covered by tests.

Verified by the reviewer from the code: the per-tool scope check on all 17 MCP tools; the
GET, POST and DELETE auth path; the key handoff between the route and `withMcpAuth` in the
installed mcp-handler 2.4.0; key hashing and lookup; audit row contents; the idempotency
flow; the transaction rethrow in trpc.ts; the attachment path pattern; the public route list.

Not verified by the reviewer (nothing was executed): that the checks pass, `npm audit`, the
live path through the Clerk middleware, Neon and Resend behavior.

## Findings

The reviewer found nothing at the highest severity: no path runs a tool without a valid key,
and every tool checks the key's scope before any work.

- ORANGE src/server/services/idempotency.ts:20 a key reused with different arguments returned the earlier result — fixed: the key is bound to a hash of its arguments, a mismatch returns `conflict` (test: "an idempotency key reused with different arguments is refused")
- ORANGE src/server/services/deal-stage.ts:53 a stage move racing a convert-to-account could reopen a converted deal — fixed: both paths lock the deal row first; conversion moved into the same service (test: "a stage move racing a convert-to-account never leaves an account on a deal that is not Won")
- ORANGE src/server/services/email-send.ts:71 the provider call had no timeout, so a hung provider left the row "sending" — fixed: 20 second timeout in src/lib/email.ts, and the timeline shows a row still "sending" after two minutes as "Delivery unconfirmed"
- ORANGE src/server/services/email-send.ts:92 a failed status write after the provider accepted returned an error and invited a duplicate send — fixed: the caller gets success (test: "if recording the result fails after the provider accepted, the caller still gets success")
- ORANGE src/server/services/email-send.ts:78 the "failed" status write was unguarded, and a timeout was labelled "Not sent" although delivery was unknown — fixed: guarded writes; a definite rejection is "failed", an unknown outcome is "unconfirmed" (tests: "an unknown outcome ... is recorded as unconfirmed", "a provider failure leaves one activity marked failed")
- ORANGE src/server/api/routers/apiKey.ts:26 `apiKey.create` requiring `scopes` and `apiKey.revoke` returning fewer fields went beyond A20 — fixed: SPEC.md A20 now names both changes. The old revoke output included the key hash.
- YELLOW src/server/services/lead-convert.ts:123 `lead.setStatus` now refuses CONVERTED and refuses a converted lead; the UI already avoids both calls
- YELLOW src/server/api/routers/deal.ts:157 `moveStageMany` refuses the whole batch when one deal is converted, as A3 requires
- YELLOW src/server/services/email-send.ts:59 a failed send now leaves a visible activity where it used to leave nothing
- YELLOW src/server/api/trpc.ts:90 a failed mutation now rolls back writes that used to commit; error codes are preserved
- YELLOW src/server/api/routers/apiKey.ts:26 a key's expiry is enforced but cannot be set from the UI — path: add an optional expiry field to the create dialog, about 20 lines
- YELLOW src/server/api/routers/apiKey.ts:61 revoking twice rewrote the time and an unknown id was a 500 — fixed (test: "revoking an unknown key is not found, and revoking twice keeps the first revocation")
- YELLOW src/lib/auth/api-key.ts:61 an unknown but well-formed key costs one database lookup with no throttle, and rejected keys write no audit row — path: a per-address limit in front of the lookup; needs a decision on trusting the forwarded address
- YELLOW prisma/migrations/20261119212317_add_api_key_scopes_and_idempotency_keys/migration.sql:5 `idempotency_keys` is never pruned and keeps result snapshots after the records are deleted — path: prune rows older than 30 days on write, about 10 lines
- YELLOW src/server/services/crm-read.ts:121 `bos1_list_pipeline_stages` is not paged — accepted: SPEC.md A17 names it as the exception
- YELLOW src/server/mcp/envelope.ts:88 internal tool errors are logged whole, which can put record content in the logs; nothing internal reaches the client
- YELLOW scripts/bos1-cli-lib.ts:154 the CLI sent the key to any `BOS1_URL`, including plain http — fixed: http is refused except for localhost (test: "the CLI refuses to send the key over plain http to a remote host")

## Coverage gaps the reviewer named, and what was done

- A10: added a test that `attachment.create` through the router opens no transaction.
- A12: added a test that GET and DELETE without a valid key get 401.
- A14: added the same-key, different-arguments test.
- A15: added audit attribution asserts for `log_activity` and `convert_lead`.
- A9: added tests for an unknown outcome and for a failed status write.
- Still open: A13 lists the write tools by hand, so a future write tool without the scope check is caught by the contract checker, not by the test suite. A17 is tested on one list tool; the others share its helper. A18 is tested in-process, not over live HTTP. A19's scope picker and A20's unchanged shapes have no UI or snapshot test.
