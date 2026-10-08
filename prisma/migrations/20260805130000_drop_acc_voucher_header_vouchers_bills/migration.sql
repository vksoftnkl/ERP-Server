-- Drop accounts.acc_voucher_header, accounts.acc_vouchers and
-- accounts.acc_voucher_bills.
--
-- Tables that survive keep their *_voucher_id columns as plain UUIDs: the
-- values are retained but no longer enforced against a parent row. Their FK
-- constraints are dropped first so the DROP TABLE below does not need CASCADE
-- (an explicit list is safer — CASCADE would silently take anything it found).

-- ── FKs from surviving tables into acc_voucher_header ───────────────────────
ALTER TABLE "stock"."opening_stock_header"
  DROP CONSTRAINT IF EXISTS "fk_osh_voucher_header";
ALTER TABLE "stock"."opening_stock_detail"
  DROP CONSTRAINT IF EXISTS "fk_osl_voucher_header";
ALTER TABLE "accounts"."acc_voucher_cheques"
  DROP CONSTRAINT IF EXISTS "fk_acc_cheques_voucher_header";
ALTER TABLE "accounts"."acc_voucher_doc_detail"
  DROP CONSTRAINT IF EXISTS "fk_acc_voucher_doc_detail_header";
ALTER TABLE "accounts"."acc_voucher_doc_register"
  DROP CONSTRAINT IF EXISTS "fk_gdr_voucher_header";

-- acc_tender_detail is partitioned by acc_year; dropping the constraint on the
-- partitioned parent removes it from every partition.
ALTER TABLE "accounts"."acc_tender_detail"
  DROP CONSTRAINT IF EXISTS "fk_td_voucher";
ALTER TABLE "accounts"."acc_tender_detail"
  DROP CONSTRAINT IF EXISTS "fk_td_settle_voucher";

-- ── Tables (children first — both reference acc_voucher_header) ─────────────
DROP TABLE IF EXISTS "accounts"."acc_voucher_bills";
DROP TABLE IF EXISTS "accounts"."acc_vouchers";
DROP TABLE IF EXISTS "accounts"."acc_voucher_header";

-- ── Enum types used only by the three tables above ──────────────────────────
DROP TYPE IF EXISTS "accounts"."VoucherBillRefType";
DROP TYPE IF EXISTS "accounts"."VoucherBillDrCr";
DROP TYPE IF EXISTS "accounts"."VoucherBillTraType";
DROP TYPE IF EXISTS "accounts"."DrCrType";
DROP TYPE IF EXISTS "accounts"."VoucherStatus";
DROP TYPE IF EXISTS "accounts"."DeviceType";
DROP TYPE IF EXISTS "accounts"."TallyExportStatus";
DROP TYPE IF EXISTS "accounts"."MessageSendStatus";
