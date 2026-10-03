-- Reconcile migration history with the live database.
--
-- The two tender tables were renamed directly in the database with
-- `ALTER TABLE ... RENAME TO ...` (outside of a migration), which left the
-- migration history out of sync ("drift"). This migration records the rename
-- of the tables and of their primary-key / foreign-key constraints so the
-- history matches both the live database and the Prisma schema. RENAME is a
-- pure catalog operation: no column, index, sequence or row data is touched.
--
-- The database is already in this final state, so this migration is registered
-- with `prisma migrate resolve --applied <name>` instead of being executed.
--   account_tender_master -> acc_tender_master
--   tender_type           -> acc_tender_types

ALTER TABLE "accounts"."account_tender_master" RENAME TO "acc_tender_master";
ALTER TABLE "accounts"."tender_type" RENAME TO "acc_tender_types";

ALTER TABLE "accounts"."acc_tender_master" RENAME CONSTRAINT "account_tender_master_pkey" TO "acc_tender_master_pkey";
ALTER TABLE "accounts"."acc_tender_types" RENAME CONSTRAINT "tender_type_pkey" TO "acc_tender_types_pkey";
ALTER TABLE "accounts"."acc_tender_master" RENAME CONSTRAINT "account_tender_master_acc_tnd_tnd_ledger_id_fkey" TO "acc_tender_master_acc_tnd_tnd_ledger_id_fkey";
ALTER TABLE "accounts"."acc_tender_master" RENAME CONSTRAINT "account_tender_master_acc_tnd_type_id_fkey" TO "acc_tender_master_acc_tnd_type_id_fkey";
