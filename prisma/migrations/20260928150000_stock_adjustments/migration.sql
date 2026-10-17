-- ═══════════════════════════════════════════════════════════════════════════
--  Stock adjustments (plan-nestjs-stock-adjustments, phase 2) — declarative
--  DDL and data only. 2026-09-28.
--
--  1. stock_voucher_item.svi_direction   a BOTH reason's line carries its own sign
--  2. acc_voucher_types 'StkAdj'          the one accounts voucher the five kinds share
--  3. app_setting_def stock.expiry_writeoff_grace_days   decision D-A2
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. the line's own direction ────────────────────────────────────────────
-- Quantities are MAGNITUDES (ck_svi_qty_sign) and the voucher type or the
-- reason decides the direction. An ADJUSTMENT line under a reason whose
-- srm_direction is BOTH needs a sign of its own: the screen keys a signed
-- quantity, the API stores |qty| here and the sign in this column. NULL
-- everywhere else. On the partitioned parent, so every year has it.
ALTER TABLE stock.stock_voucher_item
    ADD COLUMN IF NOT EXISTS svi_direction smallint;

ALTER TABLE stock.stock_voucher_item DROP CONSTRAINT IF EXISTS ck_svi_direction;
ALTER TABLE stock.stock_voucher_item
    ADD CONSTRAINT ck_svi_direction CHECK (svi_direction IS NULL OR svi_direction IN (-1, 1));

COMMENT ON COLUMN stock.stock_voucher_item.svi_direction IS
    '+1 / -1 when the line states its own direction (ADJUSTMENT under a BOTH reason); NULL when the voucher type or the reason decides. The quantity columns stay magnitudes.';

-- ── 2. the Stock Journal voucher type ──────────────────────────────────────
-- ADJUSTMENT, ISSUE, DAMAGE and EXPIRY_WRITEOFF share it (the stock document's
-- own refno prefix stays per kind: ADJ / ISS / DMG / EXP). Numbered SADJ00001,
-- yearly reset, print title STOCK JOURNAL. Not in the voucher register: it is
-- raised by the stock document, never keyed by hand.
INSERT INTO accounts.acc_voucher_types
    (vchr_type_code, vchr_type_name, vchr_type_short, vchr_category, vchr_nature, vchr_numbering_mode,
     vchr_no_prefix, vchr_no_suffix, vchr_no_width, vchr_reset_freq, vchr_allow_manual_no,
     vchr_affects_accounts, vchr_affects_inventory, vchr_is_cash_voucher, vchr_is_bank_voucher,
     vchr_print_title, vchr_sort_order, vchr_is_active,
     vchr_tally_export_enabled, vchr_tally_voucher_type_name, vchr_tally_base_voucher_type, vchr_created_by)
SELECT * FROM (VALUES
 ('StkAdj', 'Stock Adjustment', 'StkAdj', 'BOTH'::accounts."VoucherCategory", 'STOCK_JOURNAL'::accounts."VoucherNature",
         'AUTO'::accounts."VoucherNumberingMode",
         'SADJ', '', 5, 'YEARLY'::accounts."VoucherResetFreq", false, true, true, false, false,
         'STOCK JOURNAL', 350, true, true, 'Stock Journal', 'Stock Journal', 'system')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM accounts.acc_voucher_types t WHERE t.vchr_type_code = v.column1);

-- ── 3. the expiry write-off grace ──────────────────────────────────────────
-- An EXPIRY_WRITEOFF line is refused unless the lot's expiry is on or before
-- the document date plus this many days (default 0: only stock that HAS
-- expired). Anything else is DAMAGE.
INSERT INTO public.app_setting_def
    (asd_key, asd_module, asd_group, asd_data_type, asd_default_value, asd_min_value, asd_max_value,
     asd_max_scope, asd_label, asd_description, asd_sort_order, asd_created_by)
SELECT 'stock.expiry_writeoff_grace_days', 'INVENTORY', 'Stock', 'INT', '0', 0, 365,
       'COMPANY', 'Expiry write-off grace (days)',
       'An expiry write-off may cite a lot whose expiry falls within this many days AFTER the document date. 0 = only lots that have already expired.',
       0, 'SYSTEM'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_setting_def WHERE asd_key = 'stock.expiry_writeoff_grace_days');
