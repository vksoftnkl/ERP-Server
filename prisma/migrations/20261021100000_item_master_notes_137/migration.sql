-- ═══════════════════════════════════════════════════════════════════════════
--  Item master, notes 137 (server audit of 2026-10-21).
--
--  1. B6 / B5 — the user's rule (2026-10-21): an item's name, code and SKU are
--     unique among the LIVE items of ONE company, letters in any case. "Rice"
--     and "rice" used to both exist while company A and company B could not
--     both have "Rice" (uq_item_name_en_global was global and case-sensitive),
--     and code / SKU had no rule at all. The indexes hold the same-company
--     half; a SHARED item (no company) clashing with a company's item is
--     checked by ItemsMasterService.assertUniqueKeys, which no index can say.
--     The lowered key leads, so the service's lower(...) lookups use it.
--     A database holding two live items of one company whose names (codes,
--     SKUs) differ only in case refuses this migration — on purpose: which
--     one to rename is the operator's call. Find them with
--       SELECT lower(item_name_en), item_company_id, count(*)
--         FROM inventory.item_master WHERE NOT item_is_deleted
--        GROUP BY 1, 2 HAVING count(*) > 1;
--
--  2. B3 — uq_ean_code was case-sensitive while /master-lookups/item-by-barcode
--     matches in any case, so "ab12" and "AB12" could be live on two items and
--     a scan was ambiguous. Now unique on upper(ean_code). Header barcodes get
--     an index for the lookups that now read them too.
--
--  3. B1 — uq_ir_item_unit_godown was (item, unit, godown) while the service
--     keys reorders on branch + unit + godown (notes 67): two branches' rules
--     for one unit and godown were refused as a duplicate, and rows with a
--     NULL unit or godown were never protected at all. Now (item, branch,
--     unit, godown) with NULLs equal (COALESCE, which works on every
--     PostgreSQL the house runs). Before it is built, live rows that already
--     share such a key are reduced to the most recently written one (one on
--     the dev box, two rows saved 5 ms apart before notes 67 refused it).
--
--  4. D5 — reorder levels and days had no CHECK. ck_ir_nonnegative is added
--     NOT VALID (every new write is checked) and validated only where no
--     stored row breaks it, so a box with an old negative cannot fail here.
--
--  5. D7 — ipm_profit_type defaulted to 'MANUAL', which SaveItemPriceDto
--     refuses; 'By User' is the value the bulk price screen already writes
--     for a typed price. Rows a default left as 'MANUAL' are mapped too.
--
--  6. D9 — grid 71's description still said the company filter is strict and
--     that both keys are required. Notes 73 changed the SQL (own + shared
--     items, an unsent key filters nothing); this changes the words to match.
--     prisma/seed/Grid_Details.sql carries the same text.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. name / code / SKU: per company, any case ────────────────────────────
DROP INDEX IF EXISTS inventory.uq_item_name_en_global;
CREATE UNIQUE INDEX uq_item_name_en_company_ci
    ON inventory.item_master (
         lower(item_name_en),
         COALESCE(item_company_id, '00000000-0000-0000-0000-000000000000'::uuid))
 WHERE item_is_deleted = false;

CREATE UNIQUE INDEX uq_item_code_company_ci
    ON inventory.item_master (
         lower(item_code),
         COALESCE(item_company_id, '00000000-0000-0000-0000-000000000000'::uuid))
 WHERE item_is_deleted = false AND item_code IS NOT NULL;

CREATE UNIQUE INDEX uq_item_sku_company_ci
    ON inventory.item_master (
         lower(item_sku),
         COALESCE(item_company_id, '00000000-0000-0000-0000-000000000000'::uuid))
 WHERE item_is_deleted = false AND item_sku IS NOT NULL;

-- ── 2. barcodes in any case ────────────────────────────────────────────────
DROP INDEX IF EXISTS inventory.uq_ean_code;
CREATE UNIQUE INDEX uq_ean_code_ci
    ON inventory.item_ean_codes (upper(ean_code))
 WHERE ean_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_item_default_barcode_ci
    ON inventory.item_master (lower(item_default_barcode))
 WHERE item_is_deleted = false AND item_default_barcode IS NOT NULL;

-- ── 3. reorders keyed on branch too ────────────────────────────────────────
UPDATE inventory.item_reorders r
   SET ir_is_deleted   = true,
       ir_modified_on  = now(),
       ir_modified_by  = 'MIGRATION'
 WHERE r.ir_is_deleted = false
   AND EXISTS (
         SELECT 1
           FROM inventory.item_reorders k
          WHERE k.ir_is_deleted = false
            AND k.ir_item_id = r.ir_item_id
            AND k.ir_branch_id  IS NOT DISTINCT FROM r.ir_branch_id
            AND k.ir_uc_unit_id IS NOT DISTINCT FROM r.ir_uc_unit_id
            AND k.ir_godown_id  IS NOT DISTINCT FROM r.ir_godown_id
            AND (k.ir_modified_on, k.ir_id) > (r.ir_modified_on, r.ir_id));

DROP INDEX IF EXISTS inventory.uq_ir_item_unit_godown;
CREATE UNIQUE INDEX uq_ir_item_branch_unit_godown
    ON inventory.item_reorders (
         ir_item_id,
         COALESCE(ir_branch_id,  '00000000-0000-0000-0000-000000000000'::uuid),
         COALESCE(ir_uc_unit_id, '00000000-0000-0000-0000-000000000000'::uuid),
         COALESCE(ir_godown_id,  '00000000-0000-0000-0000-000000000000'::uuid))
 WHERE ir_is_deleted = false;

-- ── 4. reorder levels and days are never negative ──────────────────────────
ALTER TABLE inventory.item_reorders
  ADD CONSTRAINT ck_ir_nonnegative CHECK (
        ir_min_level >= 0 AND ir_max_level >= 0
    AND ir_reorder_level >= 0 AND ir_reorder_qty >= 0
    AND ir_lead_time_days >= 0 AND ir_review_cycle_days >= 0
    AND ir_reorder_days >= 0 AND ir_expiry_buffer_days >= 0) NOT VALID;

DO $$
BEGIN
  IF NOT EXISTS (
       SELECT 1 FROM inventory.item_reorders
        WHERE NOT (ir_min_level >= 0 AND ir_max_level >= 0
               AND ir_reorder_level >= 0 AND ir_reorder_qty >= 0
               AND ir_lead_time_days >= 0 AND ir_review_cycle_days >= 0
               AND ir_reorder_days >= 0 AND ir_expiry_buffer_days >= 0)) THEN
    ALTER TABLE inventory.item_reorders VALIDATE CONSTRAINT ck_ir_nonnegative;
  END IF;
END
$$;

-- ── 5. a profit type the API accepts ───────────────────────────────────────
ALTER TABLE inventory.item_price_master ALTER COLUMN ipm_profit_type SET DEFAULT 'By User';
UPDATE inventory.item_price_master SET ipm_profit_type = 'By User' WHERE ipm_profit_type = 'MANUAL';

-- ── 6. grid 71's description ───────────────────────────────────────────────
UPDATE fixed.grid_details
   SET grid_description = 'Item picker for every voucher line grid. Scoped by the OPTIONAL iitem_company_id (that company''s items plus the shared ones - a blank item company means every company) and iitem_branch_id (this branch''s items plus the company-wide ones). Either key may be left out of grid_param: an unsent key filters nothing.'
 WHERE grid_id = 71
   AND grid_sql LIKE '%iitem_company_id%'
   AND grid_description LIKE '%(strict)%';
