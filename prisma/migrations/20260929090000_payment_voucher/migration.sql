-- ═══════════════════════════════════════════════════════════════════════════
--  Payment (menu 100) — "Payment (menu 100) — backend plan, REVISION 2" §2.
--  The one migration the plan asks for. 2026-09-29.
--
--  /payments/* (src/modules/accountsModule/payment/) is the receipt mirrored,
--  money going OUT. This gives it what it cannot run without:
--
--    1 · voucher type 'Pmt' — the mirror of 'Rct'
--    2 · ck_alr_group admits a PAYMENT band
--    3 · roles ADVANCE_PAID, DISCOUNT_RECEIVED, BALANCES_WRITTEN_BACK
--    4 · the ledger-map catalogue, restated with the three, and the map seeded
--    5 · setting accounts.payment_salesman_mandatory ("paid by")
--    6 · menu 100 visible (49 is already hidden: 20260928200000)
--    7 · grid 123 'MAIN LIST - PAYMENTS' — the receipts grid (108) with 'Pmt'
--
--  Named 20260929090000 and not 20260928210000 as the module README first
--  said: that slot went to 20260928210000_stock_bucket_move, which also took
--  grid id 122 — so this grid is 123.
--
--  Re-runnable: every step is guarded. A fresh database (no chart, no menu
--  tree while migrations run) gets the type, the roles, the catalogue and the
--  setting here, the MAP from prisma/seed/Acc_Ledger_Map.sql at first boot,
--  menu 100 from prisma/seed/Menu_Master.sql, and the type's menu link from
--  prisma/seed/Acc_Voucher_Types_Register.sql.
--
--  PostgreSQL 18.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
--  1 · 'Pmt' — the payment screen's voucher type, the mirror of 'Rct' (D2)
--
--  NOT 'PmtV'. The receipt has 'Rct' apart from the register's 'RcpV', and the
--  Voucher Register must not list screen-99/100 documents: vchr_in_register
--  stays false, and the rule columns (party / bill-wise / TDS modes, the group
--  lists) stay at their defaults exactly as Rct's do — nothing reads them for
--  a type the register never offers. The service resolves the type BY CODE
--  (payment-enum.ts PAYMENT_VOUCHER_TYPE_CODE); the id is a serial.
--
--  vchr_menu_id = 100 only where the menu exists: fk_vchr_menu would refuse it
--  on a fresh database, where the tree is a seed that has not run yet.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO accounts.acc_voucher_types
       (vchr_type_code, vchr_type_name, vchr_type_short, vchr_category,
        vchr_nature, vchr_numbering_mode, vchr_no_prefix, vchr_no_width,
        vchr_reset_freq, vchr_allow_manual_no, vchr_affects_accounts,
        vchr_affects_inventory, vchr_is_cash_voucher, vchr_is_bank_voucher,
        vchr_print_title, vchr_sort_order, vchr_is_active,
        vchr_tally_export_enabled, vchr_tally_voucher_type_name,
        vchr_tally_base_voucher_type, vchr_menu_id, vchr_in_register,
        vchr_created_by)
SELECT 'Pmt', 'Payment', 'Pmt', 'ACCOUNTING',
       'PAYMENT', 'AUTO', 'pmt', 5,
       'YEARLY', false, true,
       false, false, false,
       'PAYMENT', 201, true,
       true, 'Payment',
       'Payment', (SELECT m.menu_id FROM fixed.menu_master m WHERE m.menu_id = 100), false,
       '20260929090000_payment_voucher'
 WHERE NOT EXISTS (SELECT 1 FROM accounts.acc_voucher_types WHERE vchr_type_code = 'Pmt');

-- A row that came in before the menu tree did.
UPDATE accounts.acc_voucher_types
   SET vchr_menu_id    = 100,
       vchr_updated_on = now(),
       vchr_updated_by = '20260929090000_payment_voucher'
 WHERE vchr_type_code = 'Pmt'
   AND vchr_menu_id IS NULL
   AND EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 100);

-- The serial stays ahead of any pinned id a seed may carry.
SELECT setval(pg_get_serial_sequence('accounts.acc_voucher_types', 'vchr_type_id'),
              (SELECT GREATEST(COALESCE(MAX(vchr_type_id), 0), 1) FROM accounts.acc_voucher_types), true)
 WHERE pg_get_serial_sequence('accounts.acc_voucher_types', 'vchr_type_id') IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════════════
--  2 · ck_alr_group admits PAYMENT
--
--  20260915130000 added the RECEIPT band and said "the payment voucher adds
--  'PAYMENT' the same way". The Posting Ledgers screen builds its sections
--  from alr_group, so the payment's roles get a section of their own.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE accounts.acc_ledger_role
    DROP CONSTRAINT IF EXISTS ck_alr_group;

ALTER TABLE accounts.acc_ledger_role
    ADD CONSTRAINT ck_alr_group
        CHECK (alr_group IN ('REVENUE', 'OUTPUT_TAX', 'PURCHASE', 'INPUT_TAX',
                             'SHARED', 'RECEIPT', 'PAYMENT', 'FUTURE'));


-- ═══════════════════════════════════════════════════════════════════════════
--  3 · The three roles (§2.2)
--
--  TDS_PAYABLE, INTEREST_PAID, BANK_CHARGES, ROUND_OFF and WRITE_OFF already
--  exist and are mapped; the payment reuses them.
--
--  ── ADVANCE_PAID ────────────────────────────────────────────────────────
--  Created for the balance-sheet regrouping it names, and — like the receipt's
--  ADVANCE_RECEIVED — posted to by nothing yet. An on-account remainder stays
--  in the party's DR leg with an ADVANCE (DR) bill beside it: moving it to
--  another ledger would leave the party's bills unequal to its ledger, and the
--  books-reconcile trial check (notes 47) would refuse every such post. See
--  the module README, "one deviation".
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO accounts.acc_ledger_role
       (alr_role, alr_label, alr_group, alr_want_type, alr_want_duty,
        alr_want_nature, alr_by_supply, alr_by_rate, alr_sort_order,
        alr_is_active, alr_remarks)
SELECT v.role, v.label, 'PAYMENT', v.want_type, NULL,
       v.want_nature, false, false, v.sort_order,
       true, v.remarks
  FROM (VALUES
        ('ADVANCE_PAID',          'Advances to suppliers', NULL::text, 'Assets'::text, 510,
         'Money paid to a party ahead of their bill. Our asset; the mirror of ADVANCE_RECEIVED. The payment keeps an on-account remainder as an ADVANCE (DR) bill on the party, so nothing posts here yet.'),
        ('DISCOUNT_RECEIVED',     'Discount received',     'INCOME',   'Income',       520,
         'A prompt-payment discount a supplier allowed us — allocations[].discount on a payment. Income; the mirror of DISCOUNT_ALLOWED.'),
        ('BALANCES_WRITTEN_BACK', 'Balances written back', 'INCOME',   'Income',       530,
         'A balance we owed and will not pay — allocations[].writeoff, or a BALANCES_WRITTEN_BACK line, on a payment. Income; the mirror of WRITE_OFF.')
       ) AS v(role, label, want_type, want_nature, sort_order, remarks)
 WHERE NOT EXISTS (SELECT 1 FROM accounts.acc_ledger_role r WHERE r.alr_role = v.role);


-- ═══════════════════════════════════════════════════════════════════════════
--  4 · The catalogue, restated with the three — then the map
--
--  fn_seed_ledger_map() §2.3 refuses an ACTIVE role that is absent from the
--  catalogue, and prisma/seed/Acc_Ledger_Map.sql would then abort on every
--  boot (the slip 20260922060000 and 20260926163000 each had to repair). So
--  the function is restated here, character for character as 20260928100000
--  left it, with the PAYMENT rows appended.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION accounts.fn_ledger_map_catalogue()
RETURNS TABLE (
    role_code   text,
    ledger_name text,
    ledger_type text,
    duty_head   text,
    group_name  text
)
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT *
      FROM (VALUES
        -- role                 ledger name                       type        duty head         group
        -- ── REVENUE ────────────────────────────────────────────────────────
        ('SALES',              'Sales Account',                  'INCOME',   NULL,             'Sales Accounts'),
        ('SALES_RETURN',       'Sales Return',                   'INCOME',   NULL,             'Sales Accounts'),
        -- ── OUTPUT_TAX ─────────────────────────────────────────────────────
        ('OUTPUT_CGST',        'Output CGST',                    'TAX',      'Central Tax',    'Duties & Taxes'),
        ('OUTPUT_SGST',        'Output SGST',                    'TAX',      'State Tax',      'Duties & Taxes'),
        ('OUTPUT_IGST',        'Output IGST',                    'TAX',      'Integrated Tax', 'Duties & Taxes'),
        ('OUTPUT_CESS',        'Output Cess',                    'TAX',      'Cess',           'Duties & Taxes'),
        ('OUTPUT_ACESS',       'Output State Cess',              'TAX',      'State Cess',     'Duties & Taxes'),
        -- ── PURCHASE ───────────────────────────────────────────────────────
        ('PURCHASE',           'Purchase Account',               'EXPENSE',  NULL,             'Purchase Accounts'),
        ('PURCHASE_RETURN',    'Purchase Return',                'EXPENSE',  NULL,             'Purchase Accounts'),
        -- ── INPUT_TAX ──────────────────────────────────────────────────────
        ('INPUT_CGST',         'Input CGST',                     'TAX',      'Central Tax',    'Duties & Taxes'),
        ('INPUT_SGST',         'Input SGST',                     'TAX',      'State Tax',      'Duties & Taxes'),
        ('INPUT_IGST',         'Input IGST',                     'TAX',      'Integrated Tax', 'Duties & Taxes'),
        ('INPUT_CESS',         'Input Cess',                     'TAX',      'Cess',           'Duties & Taxes'),
        ('INPUT_ACESS',        'Input State Cess',               'TAX',      'State Cess',     'Duties & Taxes'),
        -- ── SHARED ─────────────────────────────────────────────────────────
        ('ROUND_OFF',          'Round Off',                      'ROUNDOFF', NULL,             'Indirect Expenses'),
        ('DISCOUNT_ALLOWED',   'Discount Allowed',               'DISCOUNT', NULL,             'Indirect Expenses'),
        ('WRITE_OFF',          'Bad Debts Written Off',          'EXPENSE',  NULL,             'Indirect Expenses'),
        ('ADVANCE_RECEIVED',   'Customer Advances Received',     'GENERAL',  NULL,             'Current Liabilities'),
        ('OPENING_DIFFERENCE', 'Difference in Opening Balances', 'GENERAL',  NULL,             'Suspense A/c'),
        ('RETAINED_EARNINGS',  'Retained Earnings',              'GENERAL',  NULL,             'Reserves & Surplus'),
        -- ── FUTURE — nothing posts to these yet ────────────────────────────
        ('TCS_PAYABLE',        'TCS Payable',                    'TAX',      NULL,             'Duties & Taxes'),
        ('TDS_PAYABLE',        'TDS Payable',                    'TAX',      NULL,             'Duties & Taxes'),
        -- ── RECEIPT — 20260915120000 ───────────────────────────────────────
        ('TDS_RECEIVABLE',      'TDS Receivable',              'GENERAL', NULL, 'Current Assets'),
        ('BANK_CHARGES',        'Bank Charges',                'EXPENSE', NULL, 'Indirect Expenses'),
        ('SURCHARGE_RECOVERED', 'Card Surcharge Recovered',    'INCOME',  NULL, 'Indirect Incomes'),
        ('CLAIMS_ALLOWED',      'Customer Claims Allowed',     'EXPENSE', NULL, 'Indirect Expenses'),
        ('INTEREST_INCOME',     'Interest on Overdue',         'INCOME',  NULL, 'Indirect Incomes'),
        -- ── RECEIVED CHEQUES — 20260916120000 ──────────────────────────────
        ('BOUNCE_CHARGES_RECOVERED', 'Cheque Bounce Charges Recovered', 'INCOME', NULL, 'Indirect Incomes'),
        -- ── SALES DOCUMENTS — 20260921220000 §8, catalogued here ───────────
        ('COGS',               'Cost of Goods Sold',            'EXPENSE', NULL, 'Direct Expenses'),
        ('INVENTORY',          'Stock in Hand',                  NULL,     NULL, 'Stock-in-Hand'),
        ('LOYALTY_REDEMPTION', 'Loyalty Points Redeemed',       'EXPENSE', NULL, 'Indirect Expenses'),
        ('SCHEME_DISCOUNT',    'Scheme Discount Allowed',       'EXPENSE', NULL, 'Indirect Expenses'),
        -- ── VOUCHER REGISTER — 20260925160000 §4, catalogued here ──────────
        ('INTEREST_PAID',      'Interest Paid',                 'EXPENSE',  NULL,             'Indirect Expenses'),
        ('RATE_DIFFERENCE',    'Rate Difference',               'DISCOUNT', NULL,             'Indirect Expenses'),
        ('RCM_CGST_PAYABLE',   'RCM CGST Payable',              'TAX',      'Central Tax',    'Duties & Taxes'),
        ('RCM_SGST_PAYABLE',   'RCM SGST Payable',              'TAX',      'State Tax',      'Duties & Taxes'),
        ('RCM_IGST_PAYABLE',   'RCM IGST Payable',              'TAX',      'Integrated Tax', 'Duties & Taxes'),
        -- ── STOCK → ACCOUNTS — 20260928100000 §1.9 ─────────────────────────
        ('STOCK_SHORTAGE',     'Stock Shortage',                'EXPENSE',  NULL,             'Indirect Expenses'),
        ('STOCK_EXCESS',       'Stock Excess',                  'INCOME',   NULL,             'Indirect Incomes'),
        -- ── PAYMENT — 20260929090000 ───────────────────────────────────────
        --  The payment's three, the mirrors of ADVANCE_RECEIVED, DISCOUNT_ALLOWED
        --  and WRITE_OFF. ADVANCE_PAID is GENERAL for the reason ADVANCE_RECEIVED
        --  is: it constrains the NATURE (Assets) and lets the chart choose.
        ('ADVANCE_PAID',          'Advances to Suppliers',        'GENERAL',  NULL,             'Loans & Advances (Asset)'),
        ('DISCOUNT_RECEIVED',     'Discount Received',            'INCOME',   NULL,             'Indirect Incomes'),
        ('BALANCES_WRITTEN_BACK', 'Balances Written Back',        'INCOME',   NULL,             'Indirect Incomes')
      ) AS v(role_code, ledger_name, ledger_type, duty_head, group_name);
$$;

COMMENT ON FUNCTION accounts.fn_ledger_map_catalogue() IS
    'Role -> ledger, one row per accounts.acc_ledger_role, with the shape each ledger must have if it does not exist yet. The configuration accounts.fn_seed_ledger_map() applies; edit it with CREATE OR REPLACE in a new migration.';

-- p_skip_if_no_chart = true: on a fresh database, and on the shadow database
-- `migrate dev` replays into, the chart is a SEED that has not run yet;
-- Acc_Ledger_Map.sql maps it at first boot. Here it creates the three global
-- ledgers the catalogue names and maps the three roles to them.
SELECT accounts.fn_seed_ledger_map(true, 'migration 20260929090000');


-- ═══════════════════════════════════════════════════════════════════════════
--  5 · accounts.payment_salesman_mandatory — the "paid by" rule (§2.5)
--
--  The one setting the payment adds. The client treats it exactly like
--  accounts.receipt_salesman_mandatory, and so does the server. Everything else
--  the payment reads is the receipt's own key (receipt_bill_sort,
--  writeoff_approval_above, ppd_slabs, pdc_posting_mode, allow_posted_amend).
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.app_setting_def
       (asd_key, asd_module, asd_group, asd_data_type, asd_default_value,
        asd_allowed_values, asd_min_value, asd_max_value, asd_max_scope,
        asd_label, asd_description, asd_sort_order, asd_is_active,
        asd_needs_relogin, asd_created_by)
SELECT 'accounts.payment_salesman_mandatory', 'ACCOUNTS', 'Payment', 'BOOL', 'false',
       NULL, NULL, NULL, 'BRANCH',
       'Paid-by is mandatory',
       'Refuses a payment that names no employee as having paid it. The payment''s twin of accounts.receipt_salesman_mandatory.',
       35, true,
       false, 'system'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_setting_def WHERE asd_key = 'accounts.payment_salesman_mandatory');


-- ═══════════════════════════════════════════════════════════════════════════
--  6 · Menu 100 "Bill-wise Payment" is served now (D5: 49 stays hidden)
--
--  20260928200000 renamed it and hid it "until the payment screen is built".
--  Guarded on the name that migration gave it; Menu_Master.sql carries the
--  same answer for a fresh database.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE fixed.menu_master
   SET menu_visiblity   = true,
       menu_is_active   = true,
       menu_modified_on = now()
 WHERE menu_id = 100
   AND menu_name = 'Bill-wise Payment'
   AND (menu_visiblity IS DISTINCT FROM true OR menu_is_active IS DISTINCT FROM true);

UPDATE fixed.menu_master
   SET menu_visiblity   = false,
       menu_modified_on = now()
 WHERE menu_id = 49
   AND menu_name = 'Bill wise Payment (old)'
   AND menu_visiblity IS DISTINCT FROM false;


-- ═══════════════════════════════════════════════════════════════════════════
--  7 · Grid 123 'MAIN LIST - PAYMENTS' (§2.4)
--
--  The receipts grid (108) as it stands on the box today, with 'Pmt' in place
--  of 'Rct' — same tokens (iavh_company_id, iavh_branch_id, iavh_acc_year,
--  iavh_status, ifrom_date, ito_date; send every one, '' = no bound), same
--  columns, the labels read "Payment No" / "Payee" / "Paid". A post-dated
--  cheque's own voucher shows under its payment, not as a row.
--
--  Pinned at 123: 120 / 121 are the cheque grids (20260926190000) and 122 is
--  the stock adjustment list (20260928210000).
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_device_type,
        grid_sort_column, grid_sort_order, grid_sql, grid_status,
        grid_is_deleted, grid_created_by)
SELECT 123,
       'MAIN LIST - PAYMENTS',
       'Payment vouchers (menu 100) for a company / branch / year. PDC vouchers are excluded — they show under their payment.',
       'Desktop',
       'Date', 'Descending',
       'SELECT h.avh_voucher_id,' || E'\n' ||
       '       h.avh_company_id,' || E'\n' ||
       '       h.avh_branch_id,' || E'\n' ||
       '       h.avh_acc_year,' || E'\n' ||
       '       h.avh_voucher_refno,' || E'\n' ||
       '       h.avh_voucher_date,' || E'\n' ||
       '       p.led_name                       AS party_name,' || E'\n' ||
       '       h.avh_doc_amount,' || E'\n' ||
       '       h.avh_adjust_amount,' || E'\n' ||
       '       (h.avh_doc_amount - h.avh_adjust_amount) AS on_account_amount,' || E'\n' ||
       '       (SELECT string_agg(DISTINCT t.ttm_display_name, '', '' ORDER BY t.ttm_display_name)' || E'\n' ||
       '          FROM accounts.acc_tender_detail d' || E'\n' ||
       '          JOIN accounts.acc_tender_types  t ON t.ttm_type_id = d.td_tender_type_id' || E'\n' ||
       '         WHERE d.td_src_doc_id = h.avh_voucher_id' || E'\n' ||
       '           AND d.td_acc_year   = h.avh_acc_year' || E'\n' ||
       '           AND d.td_is_deleted = false)  AS instruments,' || E'\n' ||
       '       (SELECT count(*)' || E'\n' ||
       '          FROM accounts.acc_pdc_register r' || E'\n' ||
       '         WHERE r.apd_voucher_acc_year = h.avh_acc_year' || E'\n' ||
       '           AND r.apd_is_deleted = false' || E'\n' ||
       '           AND r.apd_voucher_id IN (' || E'\n' ||
       '                 SELECT c.avh_voucher_id FROM accounts.acc_voucher_header c' || E'\n' ||
       '                  WHERE c.avh_acc_year = h.avh_acc_year' || E'\n' ||
       '                    AND (c.avh_voucher_id = h.avh_voucher_id' || E'\n' ||
       '                     OR  c.avh_against_voucher_id = h.avh_voucher_id))) AS pdc_count,' || E'\n' ||
       '       h.avh_voucher_status,' || E'\n' ||
       '       h.avh_usr_refno,' || E'\n' ||
       '       h.avh_remarks,' || E'\n' ||
       '       rv.avh_voucher_refno             AS reversal_refno,' || E'\n' ||
       '       h.avh_created_by,' || E'\n' ||
       '       h.avh_created_on' || E'\n' ||
       '  FROM accounts.acc_voucher_header h' || E'\n' ||
       '  JOIN accounts.acc_voucher_types  vt ON vt.vchr_type_id = h.avh_voucher_type_id' || E'\n' ||
       '  JOIN accounts.acc_ledger_master  p  ON p.led_id = h.avh_party_id' || E'\n' ||
       '  LEFT JOIN accounts.acc_voucher_header rv' || E'\n' ||
       '         ON rv.avh_voucher_id = h.avh_reversal_voucher_id' || E'\n' ||
       '        AND rv.avh_acc_year   = h.avh_reversal_acc_year' || E'\n' ||
       ' WHERE h.avh_company_id = iavh_company_id::uuid' || E'\n' ||
       '   AND h.avh_branch_id  = iavh_branch_id::uuid' || E'\n' ||
       '   AND h.avh_acc_year   = iavh_acc_year::bpchar' || E'\n' ||
       '   AND vt.vchr_type_code = ''Pmt''' || E'\n' ||
       '   AND h.avh_is_deleted = false' || E'\n' ||
       '   AND h.avh_against_voucher_id IS NULL' || E'\n' ||
       '   AND (NULLIF(iavh_status, '''') IS NULL OR h.avh_voucher_status = iavh_status)' || E'\n' ||
       '   AND (NULLIF(ifrom_date, '''') IS NULL OR h.avh_voucher_date::date >= NULLIF(ifrom_date, '''')::date)' || E'\n' ||
       '   AND (NULLIF(ito_date,   '''') IS NULL OR h.avh_voucher_date::date <= NULLIF(ito_date,   '''')::date)' || E'\n' ||
       ' ORDER BY h.avh_voucher_date DESC,' || E'\n' ||
       '         h.avh_voucher_slno DESC NULLS LAST,' || E'\n' ||
       '         h.avh_created_on   DESC',
       true, false, 'system'
 WHERE NOT EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_name = 'MAIN LIST - PAYMENTS')
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_id = 123);

INSERT INTO fixed.grid_columns
       (grid_id, grid_column_number, grid_column_name, grid_column_width,
        grid_column_alignment, grid_column_visibility, grid_column_filter,
        grid_column_group, grid_column_total, grid_column_data_type,
        grid_column_is_deleted, grid_column_position, grid_column_sql_field_name,
        grid_column_created_by)
SELECT g.grid_id, v.col_no, v.col_name, v.width,
       v.align, v.visible, v.filterable,
       false, v.total, v.data_type,
       false, v.col_no, v.field,
       'system'
  FROM fixed.grid_details g
 CROSS JOIN (VALUES
        -- The four key columns: needed to open the row, never shown.
        ( 1, '#',            8.00,  'Left',   false, false, false, 'Text',     'avh_voucher_id'),
        ( 2, 'Company',      8.00,  'Left',   false, false, false, 'Text',     'avh_company_id'),
        ( 3, 'Branch',       8.00,  'Left',   false, false, false, 'Text',     'avh_branch_id'),
        ( 4, 'Year',         5.00,  'Center', false, false, false, 'Text',     'avh_acc_year'),
        ( 5, 'Payment No',   9.00,  'Left',   true,  true,  false, 'Text',     'avh_voucher_refno'),
        ( 6, 'Date',         9.00,  'Center', true,  true,  false, 'Date',     'avh_voucher_date'),
        ( 7, 'Payee',       18.00,  'Left',   true,  true,  false, 'Text',     'party_name'),
        ( 8, 'Paid',        11.00,  'Right',  true,  false, true,  'Currency', 'avh_doc_amount'),
        ( 9, 'Adjusted',    11.00,  'Right',  true,  false, true,  'Currency', 'avh_adjust_amount'),
        (10, 'On Account',  11.00,  'Right',  true,  false, true,  'Currency', 'on_account_amount'),
        (11, 'Instruments', 12.00,  'Left',   true,  true,  false, 'Text',     'instruments'),
        (12, 'PDC',          5.00,  'Right',  true,  false, false, 'Number',   'pdc_count'),
        (13, 'Status',       9.00,  'Center', true,  true,  false, 'Text',     'avh_voucher_status'),
        (14, 'Your Ref',    10.00,  'Left',   false, false, false, 'Text',     'avh_usr_refno'),
        (15, 'Remarks',     14.00,  'Left',   false, false, false, 'Text',     'avh_remarks'),
        (16, 'Reversal',    12.00,  'Left',   false, false, false, 'Text',     'reversal_refno'),
        (17, 'Created By',  10.00,  'Left',   false, false, false, 'Text',     'avh_created_by'),
        (18, 'Created On',  10.00,  'Center', false, false, false, 'Date',     'avh_created_on')
       ) AS v(col_no, col_name, width, align, visible, filterable, total, data_type, field)
 WHERE g.grid_name = 'MAIN LIST - PAYMENTS'
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns c WHERE c.grid_id = g.grid_id);

SELECT setval(pg_get_serial_sequence('fixed.grid_details', 'grid_id'),
              GREATEST((SELECT max(grid_id) FROM fixed.grid_details), 123))
 WHERE pg_get_serial_sequence('fixed.grid_details', 'grid_id') IS NOT NULL;


-- ── Read-back ──────────────────────────────────────────────────────────────
-- SELECT vchr_type_id, vchr_type_code, vchr_nature, vchr_no_prefix, vchr_menu_id, vchr_in_register
--   FROM accounts.acc_voucher_types WHERE vchr_type_code = 'Pmt';
-- SELECT r.alr_role, l.led_name, g.acc_group_name
--   FROM accounts.acc_ledger_role r
--   LEFT JOIN accounts.acc_ledger_map x ON x.alm_role = r.alr_role AND NOT x.alm_is_deleted AND x.alm_is_active
--   LEFT JOIN accounts.acc_ledger_master l ON l.led_id = x.alm_ledger_id
--   LEFT JOIN accounts.acc_group_master g ON g.acc_group_id = l.led_group_id
--  WHERE r.alr_group = 'PAYMENT';
-- SELECT menu_id, menu_name, menu_visiblity FROM fixed.menu_master WHERE menu_id IN (49, 100);
-- SELECT grid_id, grid_name FROM fixed.grid_details WHERE grid_name = 'MAIN LIST - PAYMENTS';
