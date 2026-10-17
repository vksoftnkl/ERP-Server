-- ═══════════════════════════════════════════════════════════════════════════
--  ONE price table: inventory.item_price_master becomes the MRP-bucket table.
--  2026-09-30. Plan: plan/plan-nestjs-one-price-table.md §1.
--
--  A price row gets two nullable bucket columns. Both NULL is the headline row
--  the item has always had; one set is "what stock at THIS MRP (or this sale
--  price) sells for". The resolver (price-resolver.ts) picks the exact bucket
--  before the headline — 3.0's `UPDATE stocks … WHERE max_price = …`, on the
--  price master instead of on stock. stock.stock_mrp_price is never created.
--
--  EXPAND-ONLY and re-runnable: every column is ADD … IF NOT EXISTS, every
--  constraint is dropped-if-exists and re-added. No column is removed and every
--  existing row keeps both bucket columns NULL, so all 48 live rows become
--  headline rows and every existing reader keeps working.
--
--  Prisma cannot express the generated columns' expressions, the EXCLUDE, the
--  CHECKs or the partial index; the model fragment
--  prisma/inventory/itemPricemaster.prisma says so beside the fields.
-- ═══════════════════════════════════════════════════════════════════════════

-- ex_ipm_overlap mixes equality on scalars with overlap on a range in one GiST
-- index, which needs the btree operator classes (present since the stock
-- policy migration; repeated so this file stands alone).
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ── 1.1 columns ────────────────────────────────────────────────────────────
ALTER TABLE inventory.item_price_master
  -- The bucket: the price-defining half of the lot's identity. NULL = headline.
  -- Derived by the server from the item's stock track policy, never sent by a
  -- client (ItemsPriceMasterService / PriceBucketService).
  ADD COLUMN IF NOT EXISTS ipm_bucket_mrp  numeric(18,6),
  ADD COLUMN IF NOT EXISTS ipm_bucket_sp   numeric(18,6),
  -- Null-normalised companions, the same sentinel stock_lot uses (slt_key_mrp /
  -- slt_key_sp), so the EXCLUDE below cannot be fooled by NULLs and the two
  -- tables agree by construction.
  ADD COLUMN IF NOT EXISTS ipm_key_mrp numeric(18,6)
      GENERATED ALWAYS AS (COALESCE(ipm_bucket_mrp, -1)) STORED,
  ADD COLUMN IF NOT EXISTS ipm_key_sp  numeric(18,6)
      GENERATED ALWAYS AS (COALESCE(ipm_bucket_sp,  -1)) STORED,
  -- Dormant effective dating: the defaults mean "always", a far-past start so
  -- a back-dated bill still finds its row. No screen writes these in v1.
  ADD COLUMN IF NOT EXISTS ipm_effective_from date NOT NULL DEFAULT DATE '1900-01-01',
  ADD COLUMN IF NOT EXISTS ipm_effective_to   date NOT NULL DEFAULT DATE '9999-12-31';

COMMENT ON COLUMN inventory.item_price_master.ipm_bucket_mrp IS
  'The MRP this row prices, when the item''s stock track policy tracks MRP. NULL = headline row. '
  'Derived server-side (NULLIF(ipm_max_price, 0) under track_mrp); equals ipm_max_price when set.';
COMMENT ON COLUMN inventory.item_price_master.ipm_bucket_sp IS
  'The sale-price dimension this row prices, when the policy tracks sale price. NULL = headline row. '
  'Derived server-side from the price at sales.default_price_level.';
COMMENT ON COLUMN inventory.item_price_master.ipm_key_mrp IS
  'COALESCE(ipm_bucket_mrp, -1) — the sentinel stock_lot.slt_key_mrp uses. Never written.';
COMMENT ON COLUMN inventory.item_price_master.ipm_key_sp IS
  'COALESCE(ipm_bucket_sp, -1) — the sentinel stock_lot.slt_key_sp uses. Never written.';
COMMENT ON COLUMN inventory.item_price_master.ipm_effective_from IS
  'Dormant effective dating. 1900-01-01 = always; no v1 screen writes it.';
COMMENT ON COLUMN inventory.item_price_master.ipm_effective_to IS
  'Dormant effective dating. 9999-12-31 = always; no v1 screen writes it.';

-- ── 1.2 the one-row-per-bucket rule ────────────────────────────────────────
-- One price set per bucket per scope AT A TIME. Replaces
-- uq_item_price_master_scope, which it subsumes: with the default dates every
-- range is [1900, 9999] and this is the plain one-row-per-(scope, item, unit,
-- bucket) rule. Company/branch are COALESCEd because EXCLUDE never conflicts on
-- NULL (the old index used NULLS NOT DISTINCT for the same reason). A chain row
-- (branch NULL) and a branch row for the same bucket DO coexist — that is the
-- override. DEFERRABLE so a split-and-reschedule, or a re-key after a policy
-- change, saves as one transaction. Same construction as ex_stp_overlap.
-- ipm_godown_id stays OUT of the key, exactly as before (notes 67 B1).
--
-- Added BEFORE the old index is dropped, in one migration, so there is no
-- window without the rule.
ALTER TABLE inventory.item_price_master DROP CONSTRAINT IF EXISTS ex_ipm_overlap;
ALTER TABLE inventory.item_price_master
  ADD CONSTRAINT ex_ipm_overlap EXCLUDE USING gist (
    (COALESCE(ipm_company_id, '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
    (COALESCE(ipm_branch_id,  '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
    ipm_item_id    WITH =,
    ipm_uc_unit_id WITH =,
    ipm_key_mrp    WITH =,
    ipm_key_sp     WITH =,
    daterange(ipm_effective_from, ipm_effective_to, '[]') WITH &&
  ) WHERE (ipm_is_deleted = false)
  DEFERRABLE INITIALLY IMMEDIATE;

DROP INDEX IF EXISTS inventory.uq_item_price_master_scope;

-- ── 1.3 checks ─────────────────────────────────────────────────────────────
ALTER TABLE inventory.item_price_master
  DROP CONSTRAINT IF EXISTS ck_ipm_bucket_mrp,
  DROP CONSTRAINT IF EXISTS ck_ipm_bucket_sp,
  DROP CONSTRAINT IF EXISTS ck_ipm_bucket_mrp_is_max,
  DROP CONSTRAINT IF EXISTS ck_ipm_not_above_mrp,
  DROP CONSTRAINT IF EXISTS ck_ipm_dates;
ALTER TABLE inventory.item_price_master
  ADD CONSTRAINT ck_ipm_bucket_mrp CHECK (ipm_bucket_mrp IS NULL OR ipm_bucket_mrp > 0),
  ADD CONSTRAINT ck_ipm_bucket_sp  CHECK (ipm_bucket_sp  IS NULL OR ipm_bucket_sp  > 0),
  -- A bucket row's MRP IS its max price. One MRP column on every screen, never two.
  ADD CONSTRAINT ck_ipm_bucket_mrp_is_max CHECK (
      ipm_bucket_mrp IS NULL OR ipm_max_price = ipm_bucket_mrp),
  -- Scoped to BUCKET rows. Headline rows keep the client-side rule: 5 live test
  -- rows price above their MRP today, and a headline MRP of 0 (skip_mrp shops)
  -- must stay legal.
  ADD CONSTRAINT ck_ipm_not_above_mrp CHECK (
      ipm_bucket_mrp IS NULL
      OR (ipm_sales_price_a <= ipm_bucket_mrp AND ipm_sales_price_b <= ipm_bucket_mrp
          AND ipm_sales_price_c <= ipm_bucket_mrp AND ipm_sales_price_d <= ipm_bucket_mrp)),
  ADD CONSTRAINT ck_ipm_dates CHECK (ipm_effective_to >= ipm_effective_from);

-- ── 1.4 indexes ────────────────────────────────────────────────────────────
-- The billing lookup: item + unit + bucket key, then scope. Dates ride along.
-- idx_item_price_master_item stays for the callers that read all of an item.
CREATE INDEX IF NOT EXISTS ix_ipm_lookup
    ON inventory.item_price_master (ipm_item_id, ipm_uc_unit_id, ipm_key_mrp, ipm_key_sp,
                                    ipm_company_id, ipm_branch_id)
    INCLUDE (ipm_effective_from, ipm_effective_to)
    WHERE ipm_is_deleted = false;
