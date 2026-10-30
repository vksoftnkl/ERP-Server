-- ═══════════════════════════════════════════════════════════════════════════
--  Item master, notes 67 (re-check of notes 50). 2026-09-30.
--
--  1. uq_item_name_en_global, uq_ean_code and uq_ir_item_unit_godown counted
--     SOFT-DELETED rows, so a deleted item's name, a removed EAN or a removed
--     reorder rule was burned for good (notes 50 #3). Each becomes partial on
--     "not deleted", like uq_item_price_master_scope and uq_item_unit_conversion
--     already are. Prisma cannot express a partial index, so the @@unique lines
--     come out of the model fragments with this migration; nothing in the code
--     used them as a Prisma unique key.
--     A restore of a deleted item whose name or EAN has since been taken by a
--     live one now trips these indexes — ItemsMasterService.restoreComposite
--     answers that with a 409 naming the field.
--
--  2. ipm_profit_type still held the pre-20260718140000 vocabulary on some rows
--     (BY_PERCENT / BY_AMOUNT); SaveItemPriceDto accepts only 'By %' / 'By Rs' /
--     'By User', so any save that echoed one was a 400 (notes 67 B3). Mapped.
--
--  3. Derived ITEM-scope stock track policies that should not be live (notes 50
--     #8): those of deleted items, and those derived from item flags with no
--     preset that say nothing (signature N, negative stock ALLOW) — an ITEM row
--     outranks the GROUP one, so such a row silently undid the group's preset.
--     StockTrackPolicyService no longer writes either; this retires the ones
--     already there, as retireDerived does (inactive AND deleted, so the row
--     leaves ex_stp_overlap / ix_stp_resolve). Hand-authored rows are untouched.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. partial unique indexes ──────────────────────────────────────────────
DROP INDEX IF EXISTS inventory.uq_item_name_en_global;
CREATE UNIQUE INDEX uq_item_name_en_global
    ON inventory.item_master (item_name_en)
 WHERE item_is_deleted = false;

DROP INDEX IF EXISTS inventory.uq_ean_code;
CREATE UNIQUE INDEX uq_ean_code
    ON inventory.item_ean_codes (ean_code)
 WHERE ean_is_deleted = false;

DROP INDEX IF EXISTS inventory.uq_ir_item_unit_godown;
CREATE UNIQUE INDEX uq_ir_item_unit_godown
    ON inventory.item_reorders (ir_item_id, ir_uc_unit_id, ir_godown_id)
 WHERE ir_is_deleted = false;

-- ── 2. legacy profit types ─────────────────────────────────────────────────
UPDATE inventory.item_price_master SET ipm_profit_type = 'By %'  WHERE ipm_profit_type = 'BY_PERCENT';
UPDATE inventory.item_price_master SET ipm_profit_type = 'By Rs' WHERE ipm_profit_type = 'BY_AMOUNT';

-- ── 3. derived item policies that should not be live ───────────────────────
UPDATE stock.stock_track_policy p
   SET stp_is_active   = false,
       stp_is_deleted  = true,
       stp_modified_on = now(),
       stp_modified_by = 'MIGRATION'
  FROM inventory.item_master i
 WHERE p.stp_scope = 'ITEM'
   AND p.stp_item_id = i.item_id
   AND p.stp_is_deleted = false
   AND (p.stp_remarks = 'Auto-derived from item master'
        OR p.stp_remarks LIKE 'Auto-derived from item master [%')
   AND (
         i.item_is_deleted
      OR (p.stp_remarks = 'Auto-derived from item master'
          AND p.stp_track_signature = 'N'
          AND p.stp_allow_negative = 'ALLOW')
   );
