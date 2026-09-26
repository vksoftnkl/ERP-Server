-- Reconcile migration history with the live database.
--
-- The acc_voucher_tenders table (voucher tender master) was dropped directly in
-- the database, outside of a migration, which left the migration history out of
-- sync ("drift"). Its only remaining artifact was the now-orphaned
-- "accounts"."TenderTraType" enum, which is dropped here as well. This migration
-- records both drops so the history matches the live database and the Prisma
-- schema (the AccVoucherTender model and TenderTraType enum were removed from
-- the schema fragments).
--
-- The table was already gone and the enum is dropped manually, so this migration
-- is registered with `prisma migrate resolve --applied <name>` instead of being
-- executed. Both statements use IF EXISTS so the shadow-database replay (where
-- the table and enum still exist from earlier migrations) succeeds.

DROP TABLE IF EXISTS "accounts"."acc_voucher_tenders" CASCADE;

DROP TYPE IF EXISTS "accounts"."TenderTraType";
