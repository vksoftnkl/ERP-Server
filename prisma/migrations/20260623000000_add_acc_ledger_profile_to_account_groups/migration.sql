-- AlterTable
-- Reconciles the `acc_ledger_profile` column that was added directly to the
-- database (out-of-band) without a migration. Marked as already-applied via
-- `prisma migrate resolve --applied`, so this ALTER is recorded in history but
-- NOT re-run against the live column. Definition matches the live DB exactly
-- (NOT NULL, DEFAULT 'General') so fresh replays reproduce it.
ALTER TABLE "accounts"."account_groups" ADD COLUMN "acc_ledger_profile" VARCHAR(16) NOT NULL DEFAULT 'General';
