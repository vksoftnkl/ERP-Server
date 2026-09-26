-- Enum-style value guards for sale_charge_detail. Prisma does not model CHECK
-- constraints, so these live only here and are mirrored app-side by
-- CHARGE_DETAIL_VALUE_GUARDS (src/modules/master/charge-master/types/
-- charge-master-api.types.ts) so the API returns a 400 instead of a raw 23514.
--
-- NOTE: charge_master's own equivalents were dropped in
-- 20260724130000_drop_charge_master_check_constraints and are enforced only in
-- the application. charge_detail keeps them in the DB because its rows are
-- SNAPSHOTS written by several modules — the constraint is the last line of
-- defence for a bad snapshot.

-- Which module's document the charge line hangs off (cd_doc_id is polymorphic,
-- so this is the only thing identifying the parent's table).
ALTER TABLE "public"."sale_charge_detail"
    ADD CONSTRAINT "ck_cd_doc_type"
    CHECK ("cd_doc_type" IN ('PURCHASE','SALES','GRN','QUOTATION','INVOICE'));

-- The sign of the charge.
ALTER TABLE "public"."sale_charge_detail"
    ADD CONSTRAINT "ck_cd_type"
    CHECK ("cd_type" IN ('ADD','DEDUCT'));

-- Keep in step with charge_master.chg_method (CHARGE_METHODS) — this is a
-- snapshot of it.
ALTER TABLE "public"."sale_charge_detail"
    ADD CONSTRAINT "ck_cd_method"
    CHECK ("cd_method" IS NULL OR "cd_method" IN ('FIXED','QTY','NET_QTY','KG','QTL','TON','PERCENT'));

-- Distribution basis for a FIXED lump sum.
ALTER TABLE "public"."sale_charge_detail"
    ADD CONSTRAINT "ck_cd_apply_on"
    CHECK ("cd_apply_on" IS NULL OR "cd_apply_on" IN ('FLAT','QTY','VALUE','WEIGHT'));

-- How a landing cost is allocated across the document's items.
ALTER TABLE "public"."sale_charge_detail"
    ADD CONSTRAINT "ck_cd_cost_alloc"
    CHECK ("cd_cost_alloc" IS NULL OR "cd_cost_alloc" IN ('VALUE','QTY','WEIGHT'));
