-- Row-Level Security: second, independent layer of tenant isolation.
-- The Prisma Client Extension (src/lib/db.ts) auto-injects tenantId into every
-- query, but RLS ensures cross-tenant access is impossible even if that
-- extension is ever bypassed (raw queries, a bug, a future migration).
--
-- Run this after `prisma migrate dev` / `prisma migrate deploy` against the
-- same database -- Prisma's migration engine does not manage RLS policies.

alter table "tenants" enable row level security;
alter table "memberships" enable row level security;
alter table "companies" enable row level security;
alter table "contacts" enable row level security;
alter table "pipeline_stages" enable row level security;
alter table "deals" enable row level security;
alter table "activities" enable row level security;
alter table "custom_field_definitions" enable row level security;
alter table "api_keys" enable row level security;
alter table "todos" enable row level security;
alter table "leads" enable row level security;
alter table "tags" enable row level security;
alter table "tag_assignments" enable row level security;
alter table "notifications" enable row level security;
alter table "carriers" enable row level security;
alter table "policies" enable row level security;
alter table "commissions" enable row level security;
alter table "claims" enable row level security;
alter table "vendors" enable row level security;
alter table "projects" enable row level security;
alter table "project_commissions" enable row level security;
alter table "service_tickets" enable row level security;
alter table "attachments" enable row level security;
alter table "audit_logs" enable row level security;
alter table "call_coaching_sessions" enable row level security;

-- Each app request sets `app.current_tenant_id` via `SET LOCAL` inside a
-- transaction (see src/lib/db.ts) before running any tenant-scoped query.
create policy tenant_isolation_memberships on "memberships"
  using ("tenantId" = current_setting('app.current_tenant_id', true));

create policy tenant_isolation_companies on "companies"
  using ("tenantId" = current_setting('app.current_tenant_id', true));

create policy tenant_isolation_contacts on "contacts"
  using ("tenantId" = current_setting('app.current_tenant_id', true));

create policy tenant_isolation_pipeline_stages on "pipeline_stages"
  using ("tenantId" = current_setting('app.current_tenant_id', true));

create policy tenant_isolation_deals on "deals"
  using ("tenantId" = current_setting('app.current_tenant_id', true));

create policy tenant_isolation_activities on "activities"
  using ("tenantId" = current_setting('app.current_tenant_id', true));

create policy tenant_isolation_custom_field_definitions on "custom_field_definitions"
  using ("tenantId" = current_setting('app.current_tenant_id', true));

create policy tenant_isolation_api_keys on "api_keys"
  using ("tenantId" = current_setting('app.current_tenant_id', true));

create policy tenant_isolation_todos on "todos"
  using ("tenantId" = current_setting('app.current_tenant_id', true));

create policy tenant_isolation_leads on "leads"
  using ("tenantId" = current_setting('app.current_tenant_id', true));

create policy tenant_isolation_tags on "tags"
  using ("tenantId" = current_setting('app.current_tenant_id', true));

create policy tenant_isolation_tag_assignments on "tag_assignments"
  using ("tenantId" = current_setting('app.current_tenant_id', true));

create policy tenant_isolation_notifications on "notifications"
  using ("tenantId" = current_setting('app.current_tenant_id', true));

create policy tenant_isolation_carriers on "carriers"
  using ("tenantId" = current_setting('app.current_tenant_id', true));

create policy tenant_isolation_policies on "policies"
  using ("tenantId" = current_setting('app.current_tenant_id', true));

create policy tenant_isolation_commissions on "commissions"
  using ("tenantId" = current_setting('app.current_tenant_id', true));

create policy tenant_isolation_claims on "claims"
  using ("tenantId" = current_setting('app.current_tenant_id', true));

create policy tenant_isolation_vendors on "vendors"
  using ("tenantId" = current_setting('app.current_tenant_id', true));

create policy tenant_isolation_projects on "projects"
  using ("tenantId" = current_setting('app.current_tenant_id', true));

create policy tenant_isolation_project_commissions on "project_commissions"
  using ("tenantId" = current_setting('app.current_tenant_id', true));

create policy tenant_isolation_service_tickets on "service_tickets"
  using ("tenantId" = current_setting('app.current_tenant_id', true));

create policy tenant_isolation_attachments on "attachments"
  using ("tenantId" = current_setting('app.current_tenant_id', true));

create policy tenant_isolation_audit_logs on "audit_logs"
  using ("tenantId" = current_setting('app.current_tenant_id', true));

create policy tenant_isolation_call_coaching_sessions on "call_coaching_sessions"
  using ("tenantId" = current_setting('app.current_tenant_id', true));

-- Tenants table itself has no tenantId column -- membership decides visibility,
-- enforced at the application layer (a user can only resolve orgs they belong
-- to via Clerk), so RLS is enabled here for defense-in-depth but no policy
-- restricts it beyond requiring the app's own connection role.
