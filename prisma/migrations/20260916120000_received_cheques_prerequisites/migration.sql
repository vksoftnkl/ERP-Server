-- ═══════════════════════════════════════════════════════════════════════════
--  Received Cheques (menu 51) — §2 of the backend plan, made runnable
--
--  received-cheques/plan-backend-received-cheques.md revision 1, §2.1 to §2.5.
--
--  ── WHAT STANDS BEHIND THIS ─────────────────────────────────────────────
--  accounts.acc_pdc_register is deployed, partitioned and fully constrained,
--  and the receipt module has been writing HELD rows into it since
--  20260915120000. Nothing else exists: no voucher type can carry a clearing
--  or a bounce, BOUNCE_CHARGES_RECOVERED is not a role, menu 51 is hidden and
--  there is no register grid. This migration is the whole of that gap.
--
--  Verified against localhost/ERP before writing:
--    · acc_voucher_types holds 7 rows; neither 'ChqClr' nor 'ChqBnc' is among
--      them, and ids run to 12 (a serial — nothing below hard-codes one).
--    · acc_ledger_role has BANK_CHARGES in the 'RECEIPT' band and no
--      BOUNCE_CHARGES_RECOVERED.
--    · acc_ledger_map is GLOBAL (alm_company_id IS NULL on every row) and is
--      written through accounts.fn_seed_ledger_map().
--    · menu 51 'Received Cheques' exists, menu_visiblity = false.
--    · acc_pdc_register holds 0 rows, so nothing here has to migrate data.
--
--  Every statement is NOT EXISTS / IF EXISTS guarded and re-runnable.
--
--  PostgreSQL 18.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
--  1 · §2.1 — the two voucher types
--
--  ── ChqClr is a CONTRA, and that is not a formality ──────────────────────
--  Clearing a received cheque moves money from one asset of ours to another:
--  out of 'Cheques in Hand' and into the bank. No party, no income, no
--  expense — the textbook contra. Filing it as a RECEIPT would double-count
--  collections in every "money received this month" report, because the
--  receipt that took the cheque in is already there.
--
--  vchr_is_bank_voucher = true: a clearing ALWAYS touches a bank ledger, and
--  the bank book is the report that has to show it. The receipt type leaves
--  both flags false because one receipt splits across cash, card and cheque;
--  a clearing cannot.
--
--  ── ChqBnc is a JOURNAL ──────────────────────────────────────────────────
--  A bounce is not money moving. It is the undoing of a credit that was
--  given, plus two charges — the bank's on us and ours on the party. That is
--  a journal, and filing it as a bank voucher would be a claim that the bank
--  balance moved by the cheque's amount, which it never did: the cheque was
--  never credited to us.
--
--  vchr_reset_freq YEARLY and width 5 match 'Rct'. The prefixes are the
--  FORMAT SNAPSHOT the first allocation copies onto the acc_voucher_seq row;
--  the sequence row itself is created on first use by allocateVoucherNumber,
--  so there is nothing to seed here.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO accounts.acc_voucher_types
       (vchr_type_code, vchr_type_name, vchr_type_short, vchr_category,
        vchr_nature, vchr_numbering_mode, vchr_no_prefix, vchr_no_width,
        vchr_reset_freq, vchr_allow_manual_no, vchr_affects_accounts,
        vchr_affects_inventory, vchr_is_cash_voucher, vchr_is_bank_voucher,
        vchr_print_title, vchr_sort_order, vchr_is_active,
        vchr_tally_export_enabled, vchr_tally_voucher_type_name,
        vchr_tally_base_voucher_type, vchr_created_by)
SELECT v.code, v.name, v.short, 'ACCOUNTING',
       v.nature::accounts."VoucherNature", 'AUTO', v.prefix, 5,
       'YEARLY', false, true,
       false, false, v.is_bank,
       v.print_title, v.sort_order, true,
       true, v.tally_name,
       v.tally_base, 'system'
  FROM (VALUES
        ('ChqClr', 'Cheque Clearing', 'ChqClr', 'CONTRA',  'chqclr', true,
         'CHEQUE CLEARING', 210, 'Cheque Clearing', 'Contra'),
        ('ChqBnc', 'Cheque Bounce',   'ChqBnc', 'JOURNAL', 'chqbnc', false,
         'CHEQUE BOUNCE',   220, 'Cheque Bounce',   'Journal')
       ) AS v(code, name, short, nature, prefix, is_bank,
              print_title, sort_order, tally_name, tally_base)
 WHERE NOT EXISTS (SELECT 1 FROM accounts.acc_voucher_types t
                    WHERE t.vchr_type_code = v.code);


-- ═══════════════════════════════════════════════════════════════════════════
--  2 · §2.1 — the BOUNCE_CHARGES_RECOVERED role
--
--  ── Why it is not BANK_CHARGES ──────────────────────────────────────────
--  Two different numbers on two different sides of the same event. The bank
--  charges US a return fee (BANK_CHARGES, an expense we bear). We charge the
--  PARTY for having given us paper that bounced (this role, income). A shop
--  may levy one, the other, both or neither, and netting them would hide from
--  the P&L both what bouncing cost us and what we recovered.
--
--  It joins the 'RECEIPT' band rather than 'SHARED' for the reason
--  20260915130000 gives: the Posting Ledgers screen builds itself from
--  alr_group, and a role that exists because a RECEIVED cheque bounced
--  belongs beside the other five.
--
--  alr_sort_order 460 continues the band (410..450 are the receipt five).
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO accounts.acc_ledger_role
       (alr_role, alr_label, alr_group, alr_want_type, alr_want_duty,
        alr_want_nature, alr_by_supply, alr_by_rate, alr_sort_order,
        alr_is_active, alr_remarks)
SELECT 'BOUNCE_CHARGES_RECOVERED', 'Cheque bounce charges recovered', 'RECEIPT',
       'INCOME', NULL,
       'Income', false, false, 460,
       true,
       'What the PARTY is charged when their cheque bounces. Income, and NOT the same figure as BANK_CHARGES, which is the return fee the bank charged us.'
 WHERE NOT EXISTS (SELECT 1 FROM accounts.acc_ledger_role r
                    WHERE r.alr_role = 'BOUNCE_CHARGES_RECOVERED');


-- ═══════════════════════════════════════════════════════════════════════════
--  3 · §2.1 — the catalogue, and the map
--
--  ── ONE ROW, GLOBAL — a deviation from the plan, stated ─────────────────
--  §2.1 asks for "one acc_ledger_map row per company". Every one of the 22
--  live rows in this database is GLOBAL (alm_company_id IS NULL), which is
--  what ledger-map.helper's resolver is built for: branch beats company beats
--  global, and nothing is scoped today. Writing per-company rows here would
--  make this the only role in the system configured differently from the
--  other 27, and it would silently leave a company created TOMORROW with no
--  mapping at all — the failure the role resolver is supposed to prevent.
--  The scoping columns stay available for a company that genuinely posts
--  bounce recoveries somewhere of its own; that is an override, not the seed.
--
--  CREATE OR REPLACE on a SQL function cannot append, so the catalogue body
--  is restated whole. Everything above the last line is character-for-
--  character what 20260915120000 shipped — diff it against that migration
--  before editing this one.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION accounts.fn_ledger_map_catalogue()
RETURNS TABLE (
    role_code   text,   -- accounts.acc_ledger_role.alr_role
    ledger_name text,   -- accounts.acc_ledger_master.led_name, global
    ledger_type text,   -- led_ledger_type      (chk_led_ledger_type)
    duty_head   text,   -- led_gst_duty_head    (chk_led_gst_duty_head)
    group_name  text    -- acc_group_master.acc_group_name, global
)
LANGUAGE sql
IMMUTABLE
AS $cat$
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
        --  TDS Receivable is GENERAL and not TAX: TAX carries a duty head in
        --  this chart and this is not a GST head. The role leaves
        --  alr_want_type NULL for exactly that reason and constrains the
        --  NATURE (Assets) instead, which is the part that matters.
        ('TDS_RECEIVABLE',      'TDS Receivable',              'GENERAL', NULL, 'Current Assets'),
        ('BANK_CHARGES',        'Bank Charges',                'EXPENSE', NULL, 'Indirect Expenses'),
        ('SURCHARGE_RECOVERED', 'Card Surcharge Recovered',    'INCOME',  NULL, 'Indirect Incomes'),
        ('CLAIMS_ALLOWED',      'Customer Claims Allowed',     'EXPENSE', NULL, 'Indirect Expenses'),
        ('INTEREST_INCOME',     'Interest on Overdue',         'INCOME',  NULL, 'Indirect Incomes'),
        -- ── RECEIVED CHEQUES — 20260916120000 ──────────────────────────────
        ('BOUNCE_CHARGES_RECOVERED', 'Cheque Bounce Charges Recovered', 'INCOME', NULL, 'Indirect Incomes')
      ) AS v(role_code, ledger_name, ledger_type, duty_head, group_name);
$cat$;

COMMENT ON FUNCTION accounts.fn_ledger_map_catalogue() IS
    'Role -> ledger, one row per accounts.acc_ledger_role, with the shape each ledger must have if it does not exist yet. The configuration accounts.fn_seed_ledger_map() applies; edit it with CREATE OR REPLACE in a new migration.';

--  p_skip_if_no_chart = true for the reason 20260915110000 and 20260915130000
--  both give: on a fresh database, and on the shadow database `migrate dev`
--  replays into, the chart of accounts is a SEED and has not run yet.
--  prisma/seed/Acc_Ledger_Map.sql maps it in strict mode at first boot.
SELECT accounts.fn_seed_ledger_map(true, 'migration 20260916120000');


-- ═══════════════════════════════════════════════════════════════════════════
--  4 · §2.2 — the two settings
--
--  asd_max_scope BRANCH, like the receipt's seven: what a branch charges for
--  a bounced cheque, and the reasons its operators pick from, are branch
--  operating decisions. BRANCH caps how NARROW an override may be, not how
--  wide, so a company-wide or global answer is still allowed.
--
--  ── bounce_charge_to_party is DECIMAL, not the plan's "NUMBER" ───────────
--  ck_asd_data_type admits BOOL | INT | DECIMAL | TEXT | UUID | DATE | JSON.
--  'NUMBER' is not a member and the row would be refused.
--
--  ── bounce_reasons is JSON, not the plan's "TEXT (JSON list)" ────────────
--  Same reason, the other way round: the catalogue HAS a JSON type and the
--  settings screen renders a list editor for it, where TEXT would give the
--  operator a single line to hand-type a JSON array into.
--
--  The default is a PRE-FILL, not a whitelist. cheque-bounce.service accepts
--  any non-blank reason: a bank returns cheques for reasons no list
--  anticipates, and refusing to record a bounce because its reason is not in
--  a dropdown would be the wrong end of that trade. 'Other' is on the list so
--  the screen has somewhere to put the free-text one.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.app_setting_def
       (asd_key, asd_module, asd_group, asd_data_type, asd_default_value,
        asd_allowed_values, asd_min_value, asd_max_value, asd_max_scope,
        asd_label, asd_description, asd_sort_order, asd_is_active,
        asd_needs_relogin, asd_created_by)
SELECT v.key, 'ACCOUNTS', 'Received Cheques', v.data_type, v.default_value,
       NULL::jsonb, v.min_value, NULL, 'BRANCH',
       v.label, v.description, v.sort_order, true,
       false, 'system'
  FROM (VALUES
        ('accounts.bounce_charge_to_party', 'DECIMAL', '0', 0::numeric, 10,
         'Bounce charge to the party',
         'Pre-filled into the bounce panel''s "charge the party" box. 0 means the operator types a figure every time, which is the safe default: a charge the customer was never told about is a dispute. Raising it is a deliberate act, and the operator can still clear the box on any one bounce.'),

        ('accounts.bounce_reasons', 'JSON',
         '["Funds insufficient", "Payment stopped by drawer", "Signature differs", "Account closed", "Post-dated presented early", "Stale", "Other"]',
         NULL::numeric, 20,
         'Bounce reasons offered',
         'JSON array of strings the bounce panel offers. A PRE-FILL and not a whitelist — the server accepts any non-blank reason, because a bank returns cheques for reasons no list anticipates and a bounce that cannot be recorded is worse than one recorded with an unfamiliar reason.')
       ) AS v(key, data_type, default_value, min_value, sort_order,
              label, description)
 WHERE NOT EXISTS (SELECT 1 FROM public.app_setting_def d
                    WHERE d.asd_key = v.key);


-- ═══════════════════════════════════════════════════════════════════════════
--  5 · §2.3 — the register grid
--
--  TxnMainView reads it through /configured-grid-sql, which is how every main
--  list in this system works and what makes the operator's saved widths,
--  filters and column order apply to it. The four key columns are present and
--  HIDDEN: the view needs them to open a row, and the operator must never see
--  a uuid.
--
--  ── The due bucket is COMPUTED, never stored (§10) ───────────────────────
--  FUTURE / DUE_TODAY / OVERDUE / STALE is a function of CURRENT_DATE and the
--  instrument date, and a stored copy would be wrong every morning until
--  something rewrote it. Three months is the statutory validity of a cheque
--  in India, which is what STALE means here.
--
--  Cheques In Hand comes from the cheque's OWN tender row (§5), not from
--  today's tender master: a cheque taken last year under a different tender
--  configuration still sits in the ledger it was posted to.
--
--  CANCELLED and REPLACED rows still list. A row that vanishes when it is
--  unwound is a row nobody can audit, and the replacement chain is followed
--  from the REPLACED row.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_device_type,
        grid_sort_column, grid_sort_order, grid_sql, grid_status,
        grid_is_deleted, grid_created_by)
SELECT (SELECT COALESCE(MAX(grid_id), 0) + 1 FROM fixed.grid_details),
       'MAIN LIST - RECEIVED CHEQUES',
       'Received cheques and mandates for a company / branch / year, with the due bucket computed from the instrument date.',
       'Desktop',
       'Instrument Date', 'Ascending',
       'SELECT r.apd_id,' || E'\n' ||
       '       r.apd_acc_year,' || E'\n' ||
       '       r.apd_company_id,' || E'\n' ||
       '       r.apd_branch_id,' || E'\n' ||
       '       r.apd_instrument_no,' || E'\n' ||
       '       r.apd_instrument_type,' || E'\n' ||
       '       r.apd_instrument_date,' || E'\n' ||
       '       p.led_name                        AS party_name,' || E'\n' ||
       '       r.apd_amount,' || E'\n' ||
       '       r.apd_bank_name,' || E'\n' ||
       '       r.apd_drawer_name,' || E'\n' ||
       '       r.apd_status,' || E'\n' ||
       -- §10: computed here, never stored. STALE at three months is the
       -- statutory validity of a cheque in India.
       '       CASE' || E'\n' ||
       '         WHEN r.apd_status <> ''HELD'' AND r.apd_status <> ''DEPOSITED'' THEN NULL' || E'\n' ||
       '         WHEN r.apd_instrument_date > CURRENT_DATE                 THEN ''FUTURE''' || E'\n' ||
       '         WHEN r.apd_instrument_date = CURRENT_DATE                 THEN ''DUE_TODAY''' || E'\n' ||
       '         WHEN r.apd_instrument_date < CURRENT_DATE - INTERVAL ''3 months'' THEN ''STALE''' || E'\n' ||
       '         ELSE ''OVERDUE''' || E'\n' ||
       '       END                               AS due_bucket,' || E'\n' ||
       '       r.apd_posting_mode,' || E'\n' ||
       '       r.apd_deposit_date,' || E'\n' ||
       '       r.apd_deposit_slip_no,' || E'\n' ||
       '       b.led_name                        AS deposit_bank_name,' || E'\n' ||
       -- The cheque's OWN tender row, not today's master (§5).
       '       cih.led_name                      AS cheques_in_hand_ledger,' || E'\n' ||
       '       r.apd_present_count,' || E'\n' ||
       '       r.apd_clear_date,' || E'\n' ||
       '       r.apd_bounce_date,' || E'\n' ||
       '       r.apd_bounce_reason,' || E'\n' ||
       '       r.apd_bounce_charges,' || E'\n' ||
       '       rv.avh_voucher_refno              AS receipt_refno,' || E'\n' ||
       '       cv.avh_voucher_refno              AS clear_refno,' || E'\n' ||
       '       bv.avh_voucher_refno              AS bounce_refno,' || E'\n' ||
       '       rep.apd_instrument_no             AS replaced_by_no,' || E'\n' ||
       '       r.apd_remarks,' || E'\n' ||
       '       r.apd_created_by,' || E'\n' ||
       '       r.apd_created_on' || E'\n' ||
       '  FROM accounts.acc_pdc_register    r' || E'\n' ||
       '  JOIN accounts.acc_ledger_master   p   ON p.led_id = r.apd_party_id' || E'\n' ||
       '  LEFT JOIN accounts.acc_ledger_master b ON b.led_id = r.apd_bank_ledger_id' || E'\n' ||
       '  LEFT JOIN accounts.acc_tender_detail t' || E'\n' ||
       '         ON t.td_id = r.apd_tender_id' || E'\n' ||
       '        AND t.td_is_deleted = false' || E'\n' ||
       '  LEFT JOIN accounts.acc_ledger_master cih ON cih.led_id = t.td_tender_ledger_id' || E'\n' ||
       '  LEFT JOIN accounts.acc_voucher_header rv' || E'\n' ||
       '         ON rv.avh_voucher_id = r.apd_voucher_id' || E'\n' ||
       '        AND rv.avh_acc_year   = r.apd_voucher_acc_year' || E'\n' ||
       '  LEFT JOIN accounts.acc_voucher_header cv' || E'\n' ||
       '         ON cv.avh_voucher_id = r.apd_clear_voucher_id' || E'\n' ||
       '        AND cv.avh_acc_year   = r.apd_clear_acc_year' || E'\n' ||
       '  LEFT JOIN accounts.acc_voucher_header bv' || E'\n' ||
       '         ON bv.avh_voucher_id = r.apd_bounce_voucher_id' || E'\n' ||
       '        AND bv.avh_acc_year   = r.apd_bounce_acc_year' || E'\n' ||
       '  LEFT JOIN accounts.acc_pdc_register rep' || E'\n' ||
       '         ON rep.apd_id       = r.apd_replaced_by_id' || E'\n' ||
       '        AND rep.apd_acc_year = r.apd_replaced_by_acc_year' || E'\n' ||
       ' WHERE r.apd_company_id = iapd_company_id::uuid' || E'\n' ||
       '   AND r.apd_branch_id  = iapd_branch_id::uuid' || E'\n' ||
       '   AND r.apd_acc_year   = iapd_acc_year::bpchar' || E'\n' ||
       -- 'R' only. Menu 52 (Issued Cheques) is its own plan and its own grid.
       '   AND r.apd_tra_type   = ''R''' || E'\n' ||
       '   AND r.apd_is_deleted = false' || E'\n' ||
       '   AND (NULLIF(istatus, '''') IS NULL' || E'\n' ||
       '        OR r.apd_status = ANY (string_to_array(istatus, '','')))' || E'\n' ||
       '   AND (NULLIF(ifrom, '''') IS NULL OR r.apd_instrument_date >= NULLIF(ifrom, '''')::date)' || E'\n' ||
       '   AND (NULLIF(ito,   '''') IS NULL OR r.apd_instrument_date <= NULLIF(ito,   '''')::date)' || E'\n' ||
       '   AND (NULLIF(ibank_ledger_id, '''') IS NULL' || E'\n' ||
       '        OR r.apd_bank_ledger_id = NULLIF(ibank_ledger_id, '''')::uuid)' || E'\n' ||
       '   AND (NULLIF(iparty_id, '''') IS NULL' || E'\n' ||
       '        OR r.apd_party_id = NULLIF(iparty_id, '''')::uuid)' || E'\n' ||
       '   AND (NULLIF(isearch, '''') IS NULL' || E'\n' ||
       '        OR r.apd_instrument_no ILIKE ''%'' || isearch || ''%''' || E'\n' ||
       '        OR p.led_name          ILIKE ''%'' || isearch || ''%''' || E'\n' ||
       '        OR COALESCE(r.apd_drawer_name, '''') ILIKE ''%'' || isearch || ''%''' || E'\n' ||
       '        OR COALESCE(r.apd_bank_name,   '''') ILIKE ''%'' || isearch || ''%'')' || E'\n' ||
       ' ORDER BY r.apd_instrument_date ASC, r.apd_created_on ASC',
       true, false, 'system'
 WHERE NOT EXISTS (SELECT 1 FROM fixed.grid_details
                    WHERE grid_name = 'MAIN LIST - RECEIVED CHEQUES');

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
        ( 1, '#',              8.00, 'Left',   false, false, false, 'Text',     'apd_id'),
        ( 2, 'Year',           5.00, 'Center', false, false, false, 'Text',     'apd_acc_year'),
        ( 3, 'Company',        8.00, 'Left',   false, false, false, 'Text',     'apd_company_id'),
        ( 4, 'Branch',         8.00, 'Left',   false, false, false, 'Text',     'apd_branch_id'),
        ( 5, 'Cheque No',     12.00, 'Left',   true,  true,  false, 'Text',     'apd_instrument_no'),
        ( 6, 'Type',           8.00, 'Center', false, true,  false, 'Text',     'apd_instrument_type'),
        ( 7, 'Instr Date',     9.00, 'Center', true,  true,  false, 'Date',     'apd_instrument_date'),
        ( 8, 'Party',         22.00, 'Left',   true,  true,  false, 'Text',     'party_name'),
        ( 9, 'Amount',        11.00, 'Right',  true,  false, true,  'Currency', 'apd_amount'),
        (10, 'Drawn On',      16.00, 'Left',   true,  true,  false, 'Text',     'apd_bank_name'),
        (11, 'Drawer',        14.00, 'Left',   false, false, false, 'Text',     'apd_drawer_name'),
        (12, 'Status',         9.00, 'Center', true,  true,  false, 'Text',     'apd_status'),
        (13, 'Due',            9.00, 'Center', true,  true,  false, 'Text',     'due_bucket'),
        (14, 'Posting',       10.00, 'Center', false, true,  false, 'Text',     'apd_posting_mode'),
        (15, 'Deposited',      9.00, 'Center', true,  true,  false, 'Date',     'apd_deposit_date'),
        (16, 'Slip No',       10.00, 'Left',   true,  true,  false, 'Text',     'apd_deposit_slip_no'),
        (17, 'Into Bank',     16.00, 'Left',   true,  true,  false, 'Text',     'deposit_bank_name'),
        (18, 'In Hand A/c',   16.00, 'Left',   false, false, false, 'Text',     'cheques_in_hand_ledger'),
        (19, 'Presented',      6.00, 'Right',  true,  false, false, 'Number',   'apd_present_count'),
        (20, 'Cleared',        9.00, 'Center', true,  true,  false, 'Date',     'apd_clear_date'),
        (21, 'Bounced',        9.00, 'Center', true,  true,  false, 'Date',     'apd_bounce_date'),
        (22, 'Bounce Reason', 18.00, 'Left',   true,  true,  false, 'Text',     'apd_bounce_reason'),
        (23, 'Charges',       10.00, 'Right',  false, false, true,  'Currency', 'apd_bounce_charges'),
        (24, 'Receipt',       12.00, 'Left',   true,  true,  false, 'Text',     'receipt_refno'),
        (25, 'Clearing',      12.00, 'Left',   false, false, false, 'Text',     'clear_refno'),
        (26, 'Bounce Vch',    12.00, 'Left',   false, false, false, 'Text',     'bounce_refno'),
        (27, 'Replaced By',   12.00, 'Left',   false, false, false, 'Text',     'replaced_by_no'),
        (28, 'Remarks',       14.00, 'Left',   false, false, false, 'Text',     'apd_remarks'),
        (29, 'Created By',    10.00, 'Left',   false, false, false, 'Text',     'apd_created_by'),
        (30, 'Created On',    10.00, 'Center', false, false, false, 'Date',     'apd_created_on')
       ) AS v(col_no, col_name, width, align, visible, filterable, total, data_type, field)
 WHERE g.grid_name = 'MAIN LIST - RECEIVED CHEQUES'
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns c
                    WHERE c.grid_id = g.grid_id);

SELECT setval(pg_get_serial_sequence('fixed.grid_details', 'grid_id'),
              (SELECT MAX(grid_id) FROM fixed.grid_details))
 WHERE pg_get_serial_sequence('fixed.grid_details', 'grid_id') IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════════════
--  6 · §2.4 — the deposit slip
--
--  ── WHAT THIS DOES AND DOES NOT DO, STATED ──────────────────────────────
--  §2.4 asks for a print DATASET named cheque_deposit_slip and one generic
--  layout. public.print_template_dataset rows hang off a
--  print_template_version — a dataset cannot exist on its own — so "register
--  the dataset" means "ship a whole template", which is the printing module's
--  work and its own layout decisions.
--
--  What is seeded here is the PURPOSE, which is the part this module owns and
--  the hook a template is later assigned to. The dataset itself is served by
--  GET /api/v1/cheques/deposit-slip, exactly as plan §4.8 allows ("or the
--  print pipeline's own endpoint once 17 lands"). When a template is built,
--  it reads the same shape from the same place.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.print_purpose
       (ppo_code, ppo_name, ppo_src_module, ppo_doc_type, ppo_copy_count,
        ppo_copy_labels, ppo_allow_reprint, ppo_sort_order, ppo_notes,
        ppo_is_active, ppo_is_deleted)
SELECT 'CHEQUE_DEPOSIT_SLIP', 'Cheque Deposit Slip', 'ACCOUNTS', 'DEPOSIT_SLIP', 2,
       'Bank Copy,Our Copy', true, 210,
       'One slip per (company, bank ledger, deposit date, slip no). The bank''s own account from accounts.acc_ledger_bank_accounts, then one line per cheque deposited under that slip. Served by GET /api/v1/cheques/deposit-slip until a template version carries it.',
       true, false
 WHERE NOT EXISTS (SELECT 1 FROM public.print_purpose
                    WHERE ppo_code = 'CHEQUE_DEPOSIT_SLIP');


-- ═══════════════════════════════════════════════════════════════════════════
--  7 · §2.5 — the menu
--
--  51 becomes visible: it is the screen this module serves, and it has been
--  hidden since the menu tree was seeded because nothing stood behind it.
--
--  52 "Issued Cheques" stays hidden. It is the payable side — apd_tra_type
--  'P', our cheques handed to suppliers — and it is its own plan.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE fixed.menu_master
   SET menu_visiblity = true,
       menu_is_active = true
 WHERE menu_id = 51
   AND menu_name = 'Received Cheques';


-- ── Read-back ──────────────────────────────────────────────────────────────
--
-- SELECT vchr_type_id, vchr_type_code, vchr_nature, vchr_is_bank_voucher
--   FROM accounts.acc_voucher_types WHERE vchr_type_code IN ('ChqClr', 'ChqBnc');
--
-- SELECT r.alr_role, l.led_name AS posts_to
--   FROM accounts.acc_ledger_role r
--   LEFT JOIN accounts.acc_ledger_map    x ON x.alm_role = r.alr_role
--                                         AND NOT x.alm_is_deleted AND x.alm_is_active
--   LEFT JOIN accounts.acc_ledger_master l ON l.led_id = x.alm_ledger_id
--  WHERE r.alr_role = 'BOUNCE_CHARGES_RECOVERED';
--
-- SELECT asd_key, asd_data_type, asd_default_value FROM public.app_setting_def
--  WHERE asd_key LIKE 'accounts.bounce%';
--
-- SELECT grid_id FROM fixed.grid_details WHERE grid_name = 'MAIN LIST - RECEIVED CHEQUES';
--
-- SELECT menu_id, menu_name, menu_visiblity FROM fixed.menu_master WHERE menu_id = 51;
