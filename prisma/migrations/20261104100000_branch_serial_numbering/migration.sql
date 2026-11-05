-- ═══════════════════════════════════════════════════════════════════════════
--  Branch serial numbering (Shared/Prathap/purchase/plan-branch-serial-numbering.md
--  §8 + §9.3; the user's answers 2026-11-04: Q1–Q9 = the plan's recommendation).
--
--  A printed document number becomes ONE series per company + branch + doc type +
--  accounting year (PUR/2026-2027/CBE/00001) instead of one per device. The
--  numbers come from accounts.acc_voucher_seq ('MAIN' series) through the
--  TypeScript allocator; nothing here numbers anything, and no DB function or
--  trigger is added. Old documents keep their numbers: no document row is touched.
--
--  1. acc_voucher_seq.seq_voucher_prefix varchar(20) -> varchar(60) (BSN-06):
--     the expanded snapshot 'PUR/2026-2027/ABCDEFGHIJ/' is 25 characters.
--     Not partitioned, no index or view uses the column; widening is metadata only.
--  2. Seven numbering-only voucher types (BSN-10). They affect inventory only,
--     post no accounts voucher, and exist so each document series has its own
--     counter row. Looked up by CODE in TypeScript (ids are sequence values and
--     differ between databases). vchr_menu_id is NULL where the menu is absent
--     (a fresh database seeds menus after migrations).
--         PO      Purchase Order        PO/{FY}/{BR}/   menu 23
--         SV-ADJ  Stock Adjustment No.  ADJ/{FY}/{BR}/  menu 264
--         SV-ISS  Stock Issue No.       ISS/{FY}/{BR}/  menu 264
--         SV-DMG  Damage Write-off No.  DMG/{FY}/{BR}/  menu 264
--         SV-EXP  Expiry Write-off No.  EXP/{FY}/{BR}/  menu 264
--         SV-TRF  Stock Transfer No.    TRF/{FY}/{BR}/  menu 41 (godown + branch outward)
--         SV-TRI  Transfer Receipt No.  TRI/{FY}/{BR}/  menu 193
--     Type 48 TRF is NOT reused: its counter numbers transfer accounts vouchers.
--     Then the four purchase types whose counters are unused (no acc_voucher_seq
--     row on 2026-11-04) take the same token form: GRN, PUR, PRN, SHR.
--     {FY} = the accounting year as stored, {BR} = the branch number code (Bill
--     Prefix, else Branch Code). Both are expanded by findOrCreateSequence() only
--     when it creates the year's counter row, so a prefix is frozen per year.
--  3. Stock list grids (BSN-16): the secondary sort svh_slno (per device) becomes
--     svh_created_on, then svh_id, so the lists run in number order and agree with
--     /txn/adjacent's (date, created_on, id) walk. On .106: 99 Opening, 101
--     Physical, 122 Stock Adjustment, 183 Godown Transfer, 184 Branch Outward,
--     185 Branch Inward. Matched by grid name AND the old ORDER BY text, because
--     183-185 were registered through the API and carry other ids elsewhere; a
--     grid already changed is not touched. Grid SQL holds no comments.
--     prisma/seed/Grid_Details.sql (99, 101, 122) and the share registration
--     scripts (183-185) carry the same text.
--  4. sales.pos_series_per_device retired (BSN-12, Q3 c = yes): POS bills take
--     the branch series like WHOLESALE. No app_setting_value row exists for it.
--  5. Plain wording rows (notes 120) for the six new refusal codes (BSN-11),
--     catalogue 2026-11-04.1. prisma/seed/Error_Messages.json carries the same rows.
--
--  Re-runnable: every statement is guarded.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · counter prefix snapshot width ───────────────────────────────────────
ALTER TABLE accounts.acc_voucher_seq
  ALTER COLUMN seq_voucher_prefix TYPE varchar(60);

-- ── 2 · voucher types ───────────────────────────────────────────────────────
INSERT INTO accounts.acc_voucher_types
    (vchr_type_code, vchr_type_name, vchr_type_short, vchr_category, vchr_nature, vchr_numbering_mode,
     vchr_no_prefix, vchr_no_suffix, vchr_no_width, vchr_reset_freq, vchr_allow_manual_no,
     vchr_affects_accounts, vchr_affects_inventory, vchr_is_cash_voucher, vchr_is_bank_voucher,
     vchr_print_title, vchr_sort_order, vchr_is_active,
     vchr_tally_export_enabled, vchr_tally_voucher_type_name, vchr_tally_base_voucher_type,
     vchr_menu_id, vchr_created_by)
SELECT v.code, v.name, v.code, 'INVENTORY'::accounts."VoucherCategory", v.nature::accounts."VoucherNature",
       'AUTO'::accounts."VoucherNumberingMode", v.prefix, '', 5, 'YEARLY'::accounts."VoucherResetFreq", false,
       false, true, false, false,
       NULL, v.sort, true,
       false, NULL, NULL,
       (SELECT m.menu_id FROM fixed.menu_master m WHERE m.menu_id = v.menu), 'system'
  FROM (VALUES
        ('PO',     'Purchase Order',       'PURCHASE',      'PO/{FY}/{BR}/',  369,  23),
        ('SV-ADJ', 'Stock Adjustment No.', 'STOCK_JOURNAL', 'ADJ/{FY}/{BR}/', 910, 264),
        ('SV-ISS', 'Stock Issue No.',      'STOCK_JOURNAL', 'ISS/{FY}/{BR}/', 911, 264),
        ('SV-DMG', 'Damage Write-off No.', 'STOCK_JOURNAL', 'DMG/{FY}/{BR}/', 912, 264),
        ('SV-EXP', 'Expiry Write-off No.', 'STOCK_JOURNAL', 'EXP/{FY}/{BR}/', 913, 264),
        ('SV-TRF', 'Stock Transfer No.',   'STOCK_JOURNAL', 'TRF/{FY}/{BR}/', 914,  41),
        ('SV-TRI', 'Transfer Receipt No.', 'STOCK_JOURNAL', 'TRI/{FY}/{BR}/', 915, 193)
       ) AS v(code, name, nature, prefix, sort, menu)
 WHERE NOT EXISTS (SELECT 1 FROM accounts.acc_voucher_types t WHERE t.vchr_type_code = v.code)
 ORDER BY v.sort;

UPDATE accounts.acc_voucher_types
   SET vchr_no_prefix = vchr_type_code || '/{FY}/{BR}/',
       vchr_updated_on = now(),
       vchr_updated_by = 'system'
 WHERE vchr_type_code IN ('GRN', 'PUR', 'PRN', 'SHR')
   AND vchr_no_prefix = vchr_type_code;

-- ── 3 · stock list grids: secondary sort by entry, not by device serial ─────
UPDATE fixed.grid_details
   SET grid_sql = replace(grid_sql,
                          'ORDER BY v.svh_doc_date DESC, v.svh_slno DESC',
                          'ORDER BY v.svh_doc_date DESC, v.svh_created_on DESC, v.svh_id DESC'),
       grid_modified_by = 'system',
       grid_modified_on = now()
 WHERE grid_name IN ('MAIN LIST - OPENING STOCK', 'MAIN LIST - PHYSICAL STOCK')
   AND position('ORDER BY v.svh_doc_date DESC, v.svh_slno DESC' IN grid_sql) > 0;

UPDATE fixed.grid_details
   SET grid_sql = replace(grid_sql,
                          'ORDER BY h.svh_doc_date DESC, h.svh_slno DESC NULLS LAST, h.svh_created_on DESC',
                          'ORDER BY h.svh_doc_date DESC, h.svh_created_on DESC, h.svh_id DESC'),
       grid_modified_by = 'system',
       grid_modified_on = now()
 WHERE grid_name IN ('TXN MAIN LIST - STOCK ADJUSTMENT', 'MAIN LIST - GODOWN TRANSFER',
                     'MAIN LIST - BRANCH OUTWARD', 'MAIN LIST - BRANCH INWARD')
   AND position('ORDER BY h.svh_doc_date DESC, h.svh_slno DESC NULLS LAST, h.svh_created_on DESC' IN grid_sql) > 0;

-- ── 4 · retire the per-device POS series ────────────────────────────────────
UPDATE public.app_setting_def
   SET asd_is_active   = false,
       asd_modified_on = now(),
       asd_modified_by = 'system'
 WHERE asd_key = 'sales.pos_series_per_device'
   AND asd_is_active = true;

-- ── 5 · plain wording rows (notes 120), catalogue 2026-11-04.1 ──────────────
INSERT INTO fixed.error_message
    (erm_code, erm_variant, erm_lang, erm_title, erm_line, erm_todo)
VALUES
     ('SEQUENCE_BRANCH_CODE_MISSING', '', 'en', 'Branch prefix needed', 'This branch has no bill prefix for document numbers.', 'Set Bill Prefix in Branches, then save again.')
    ,('SEQUENCE_BRANCH_CODE_INVALID', '', 'en', 'Wrong branch prefix', 'The branch prefix may have only letters, numbers and "-".', 'Correct Bill Prefix in Branches, then save again.')
    ,('SEQUENCE_NUMBER_TAKEN', '', 'en', 'Number already used', 'This document number is already on another document.', 'Save again. If it repeats, call support.')
    ,('SEQUENCE_SERIES_EXHAUSTED', '', 'en', 'No free number', 'The next numbers of this series are all used.', 'Call support to move the series on.')
    ,('BRANCH_BILL_PREFIX_INVALID', '', 'en', 'Wrong bill prefix', 'Bill prefix may have only letters, numbers and "-", up to 10.', 'Type a short prefix like CBE.')
    ,('BRANCH_BILL_PREFIX_DUPLICATE', '', 'en', 'Prefix already used', 'Another branch of this company has this bill prefix.', 'Type a different prefix.')
ON CONFLICT (erm_code, erm_variant, erm_lang) DO NOTHING;

UPDATE fixed.error_message_catalogue
   SET emc_version   = '2026-11-04.1',
       emc_row_count = (SELECT count(*) FROM fixed.error_message WHERE erm_is_active),
       emc_loaded_on = now()
 WHERE emc_id = 1
   AND emc_version < '2026-11-04.1';
