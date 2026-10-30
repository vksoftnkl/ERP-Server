-- ════════════════════════════════════════════════════════════════════════════
-- 20261023150000_textile_auto_batch_no — textile plan (2026-10-23), server S1/S2
--
--  1. acc_voucher_types 'BATCH'       D2: the counter behind <branch><YY>-<NNNNN>
--  2. app_setting_def stock.auto_batch_no   D3: the company switch, default off
--  3. stock_lot ix_slt_key_batch      D5: the batch scan, folded as the key folds
--
-- The TEXTILE_BATCH preset (D4) is a shared preset row: it lives in
-- prisma/seed/Stock_Track_Presets.sql with the other eight.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. the batch number counter ────────────────────────────────────────────
-- Counter only: nothing is ever posted under it. allocateVoucherNumber draws
-- from accounts.acc_voucher_seq per (type, company, branch, acc_year, device
-- 'MAIN'), so the count runs per branch per year. No prefix here: the server
-- writes the branch code and year in front of the number itself.
-- chk_acc_voucher_types_affect_anything wants accounts OR inventory, and
-- chk_acc_voucher_types_nature has no counter-only nature: INVENTORY /
-- STOCK_JOURNAL, as the opening stock type. Never reset (the year is in the
-- scope already); not in the voucher register, not exported to Tally.
INSERT INTO accounts.acc_voucher_types
    (vchr_type_code, vchr_type_name, vchr_type_short, vchr_category, vchr_nature, vchr_numbering_mode,
     vchr_no_prefix, vchr_no_suffix, vchr_no_width, vchr_reset_freq, vchr_allow_manual_no,
     vchr_affects_accounts, vchr_affects_inventory, vchr_is_cash_voucher, vchr_is_bank_voucher,
     vchr_print_title, vchr_sort_order, vchr_is_active,
     vchr_tally_export_enabled, vchr_tally_voucher_type_name, vchr_tally_base_voucher_type, vchr_created_by)
SELECT * FROM (VALUES
 ('BATCH', 'Batch Number', 'BATCH', 'INVENTORY'::accounts."VoucherCategory", 'STOCK_JOURNAL'::accounts."VoucherNature",
         'AUTO'::accounts."VoucherNumberingMode",
         NULL::varchar, NULL::varchar, 5, 'NEVER'::accounts."VoucherResetFreq", false, false, true, false, false,
         NULL::varchar, 900, true, false, NULL::varchar, NULL::varchar, 'system')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM accounts.acc_voucher_types t WHERE t.vchr_type_code = v.column1);

-- ── 2. the switch ──────────────────────────────────────────────────────────
INSERT INTO public.app_setting_def
    (asd_key, asd_module, asd_group, asd_data_type, asd_default_value,
     asd_max_scope, asd_label, asd_description, asd_sort_order, asd_created_by)
SELECT 'stock.auto_batch_no', 'INVENTORY', 'Stock', 'BOOL', 'false',
       'COMPANY', 'Number batches automatically',
       'On: saving an inward document (opening stock) gives every line with no batch number, on an item whose tracking includes batch, the next number of its branch and year, e.g. CBE26-00001 (bill prefix, else branch code, then the year). A typed batch is kept. Off: a blank batch on a batch-tracked line is refused at post.',
       10, 'SYSTEM'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_setting_def WHERE asd_key = 'stock.auto_batch_no');

-- ── 3. the scan's index ────────────────────────────────────────────────────
-- ix_slt_batch_no is on the batch AS TYPED; a scan matches the label folded
-- the way slt_key_batch folds it (upper(btrim())), which that index cannot
-- serve. Partial, so DB-only (stockLot.prisma lists it).
CREATE INDEX IF NOT EXISTS ix_slt_key_batch
    ON stock.stock_lot (slt_company_id, slt_key_batch)
 WHERE slt_key_batch <> '~' AND slt_is_deleted = false;
