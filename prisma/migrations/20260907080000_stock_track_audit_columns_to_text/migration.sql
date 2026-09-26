/*
  stock_track_policy and stock_track_preset were the last two models in the
  `stock` schema whose stp_created_by / spt_created_by still carried a real
  foreign key into public.user_master. Every other table in the schema
  (stock_balance, stock_ledger, stock_lot, stock_item_cost, stock_voucher …)
  keeps its created_by / modified_by as a plain scalar with no FK, so these two
  are brought in line: the constraint goes, and the columns widen from uuid to
  text so they can hold a login name rather than only a user id.

  Only stp_created_by / spt_created_by ever had the constraint — the matching
  _modified_by columns were already scalar and only change type here.

  uuid -> text has no implicit cast in PostgreSQL, so each ALTER spells out its
  USING clause. Existing values survive as their canonical 36-character text
  form; nothing is dropped.
*/

BEGIN;

-- DropForeignKey
ALTER TABLE "stock"."stock_track_policy" DROP CONSTRAINT IF EXISTS "fk_stp_created_by";
ALTER TABLE "stock"."stock_track_preset" DROP CONSTRAINT IF EXISTS "fk_spt_created_by";

-- AlterTable
ALTER TABLE "stock"."stock_track_policy"
  ALTER COLUMN "stp_created_by"  SET DATA TYPE TEXT USING "stp_created_by"::TEXT,
  ALTER COLUMN "stp_modified_by" SET DATA TYPE TEXT USING "stp_modified_by"::TEXT;

-- AlterTable
ALTER TABLE "stock"."stock_track_preset"
  ALTER COLUMN "spt_created_by"  SET DATA TYPE TEXT USING "spt_created_by"::TEXT,
  ALTER COLUMN "spt_modified_by" SET DATA TYPE TEXT USING "spt_modified_by"::TEXT;

COMMIT;
