-- Rollback for prisma/migrations/20261119212317_add_api_key_scopes_and_idempotency_keys.
-- Loses: the scopes on every API key (keys stop working until scopes are set again after a
-- re-apply) and the stored idempotency results. No CRM record is touched.
-- The last statement removes the migration's row from Prisma's history, so
-- `npx prisma migrate deploy` applies it again. (`prisma migrate resolve --rolled-back`
-- refuses a migration that applied successfully; observed on Prisma 7.10.1, 2026-11-19.)
BEGIN;
DROP TABLE IF EXISTS "idempotency_keys";
ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "scopes";
DELETE FROM "_prisma_migrations"
  WHERE "migration_name" = '20261119212317_add_api_key_scopes_and_idempotency_keys';
COMMIT;
