-- ════════════════════════════════════════════════════════════════════════════
-- 20260926100000_voucher_register_grids — the Voucher Register's grids and ui_tables
--
-- Spec: share/accounts/voucher_register.md §10. The screen's LIST (F8) and the
-- exceptions report are REGISTERED GRIDS served by /configured-grid-sql, like
-- every other main list here; the legs grid and the bill-wise panel are
-- ui_tables the client lays out from. The routes (/vouchers/*) carry the
-- pickers, balances and facts — nothing here is a picker.
--
--   grid 117  TXN MAIN LIST - VOUCHER REGISTER   the F8 list, filtered to the
--             types the caller may VIEW (user_menus on vchr_menu_id)
--   grid 118  VOUCHER REGISTER - EXCEPTIONS      register vouchers whose
--             allocations touch a SALES / PURCHASE bill in the period (S16 guard 5)
--   ui_table 39  VOUCHER REGISTER - LEGS
--   ui_table 40  VOUCHER REGISTER - BILLWISE
--
-- Ids are PINNED (the client opens a grid / layout by id, and the seeds pin
-- every id for that reason); the sequences are moved past them. Re-runnable:
-- every insert is guarded by name.
--
-- Grid params (the grid-runner's bare-token convention, memory
-- configured-grid-param-convention): icompany_id, ibranch_id, iacc_year,
-- ifrom_date, ito_date, itype_code, iuser_id. SEND EVERY TOKEN, dates and the
-- type code as '' for "no bound" — an unsent token behind a cast is a 400.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. grid 117 · the list ──────────────────────────────────────────────────
INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_device_type,
        grid_sort_column, grid_sort_order, grid_sql, grid_status,
        grid_is_deleted, grid_created_by)
SELECT 117,
       'TXN MAIN LIST - VOUCHER REGISTER',
       'Voucher Register vouchers for a company / branch / year, only the types the user may view. itype_code narrows to one type; '''' = every permitted type. Rev mirrors are not listed (they hang off their original); a CANCELLED original stays listed.',
       'Desktop',
       'Date', 'Descending',
       'SELECT h.avh_voucher_id,' || E'\n' ||
       '       h.avh_company_id,' || E'\n' ||
       '       h.avh_branch_id,' || E'\n' ||
       '       h.avh_acc_year,' || E'\n' ||
       '       vt.vchr_type_code,' || E'\n' ||
       '       vt.vchr_type_name                AS type_name,' || E'\n' ||
       '       h.avh_voucher_refno,' || E'\n' ||
       '       h.avh_voucher_date,' || E'\n' ||
       '       CASE WHEN vt.vchr_party_mode = ''MANY'' AND h.avh_party_id IS NULL THEN ''— several —''' || E'\n' ||
       '            ELSE p.led_name END          AS party_name,' || E'\n' ||
       '       h.avh_doc_refno,' || E'\n' ||
       '       h.avh_remarks,' || E'\n' ||
       '       h.avh_total_debit,' || E'\n' ||
       '       h.avh_total_credit,' || E'\n' ||
       '       h.avh_voucher_status,' || E'\n' ||
       '       rv.avh_voucher_refno             AS reversal_refno,' || E'\n' ||
       '       h.avh_created_by,' || E'\n' ||
       '       h.avh_created_on' || E'\n' ||
       '  FROM accounts.acc_voucher_header h' || E'\n' ||
       '  JOIN accounts.acc_voucher_types  vt ON vt.vchr_type_id = h.avh_voucher_type_id' || E'\n' ||
       '  JOIN public.user_menus           um ON um.um_menu_id = vt.vchr_menu_id' || E'\n' ||
       '                                    AND um.um_user_id = iuser_id::uuid' || E'\n' ||
       '                                    AND um.um_is_deleted = false' || E'\n' ||
       '                                    AND um.um_can_view = true' || E'\n' ||
       '  LEFT JOIN accounts.acc_ledger_master p ON p.led_id = h.avh_party_id' || E'\n' ||
       '  LEFT JOIN accounts.acc_voucher_header rv' || E'\n' ||
       '         ON rv.avh_voucher_id = h.avh_reversal_voucher_id' || E'\n' ||
       '        AND rv.avh_acc_year   = h.avh_reversal_acc_year' || E'\n' ||
       ' WHERE h.avh_company_id = icompany_id::uuid' || E'\n' ||
       '   AND h.avh_branch_id  = ibranch_id::uuid' || E'\n' ||
       '   AND h.avh_acc_year   = iacc_year::bpchar' || E'\n' ||
       '   AND vt.vchr_in_register = true' || E'\n' ||
       '   AND h.avh_is_deleted = false' || E'\n' ||
       '   AND (NULLIF(itype_code, '''') IS NULL OR vt.vchr_type_code = itype_code)' || E'\n' ||
       '   AND (NULLIF(ifrom_date, '''') IS NULL OR h.avh_voucher_date >= NULLIF(ifrom_date, '''')::date)' || E'\n' ||
       '   AND (NULLIF(ito_date,   '''') IS NULL OR h.avh_voucher_date <= NULLIF(ito_date,   '''')::date)' || E'\n' ||
       ' ORDER BY h.avh_voucher_date DESC, h.avh_voucher_slno DESC NULLS LAST, h.avh_created_on DESC',
       true, false, 'system'
 WHERE NOT EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_name = 'TXN MAIN LIST - VOUCHER REGISTER')
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_id = 117);

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
        ( 1, '#',           8.00, 'Left',   false, false, false, 'Text',     'avh_voucher_id'),
        ( 2, 'Company',     8.00, 'Left',   false, false, false, 'Text',     'avh_company_id'),
        ( 3, 'Branch',      8.00, 'Left',   false, false, false, 'Text',     'avh_branch_id'),
        ( 4, 'Year',        5.00, 'Center', false, false, false, 'Text',     'avh_acc_year'),
        ( 5, 'Code',        5.00, 'Left',   false, true,  false, 'Text',     'vchr_type_code'),
        ( 6, 'Type',       12.00, 'Left',   true,  true,  false, 'Text',     'type_name'),
        ( 7, 'Voucher No', 11.00, 'Left',   true,  true,  false, 'Text',     'avh_voucher_refno'),
        ( 8, 'Date',        9.00, 'Center', true,  true,  false, 'Date',     'avh_voucher_date'),
        ( 9, 'Party',      22.00, 'Left',   true,  true,  false, 'Text',     'party_name'),
        (10, 'Their Ref',  10.00, 'Left',   true,  true,  false, 'Text',     'avh_doc_refno'),
        (11, 'Narration',  18.00, 'Left',   true,  false, false, 'Text',     'avh_remarks'),
        (12, 'Debit',      11.00, 'Right',  true,  false, true,  'Currency', 'avh_total_debit'),
        (13, 'Credit',     11.00, 'Right',  true,  false, true,  'Currency', 'avh_total_credit'),
        (14, 'Status',      9.00, 'Center', true,  true,  false, 'Text',     'avh_voucher_status'),
        (15, 'Reversal',   10.00, 'Left',   true,  false, false, 'Text',     'reversal_refno'),
        (16, 'Created By', 10.00, 'Left',   false, false, false, 'Text',     'avh_created_by'),
        (17, 'Created On', 10.00, 'Center', false, false, false, 'Date',     'avh_created_on')
       ) AS v(col_no, col_name, width, align, visible, filterable, total, data_type, field)
 WHERE g.grid_name = 'TXN MAIN LIST - VOUCHER REGISTER'
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns c WHERE c.grid_id = g.grid_id);

-- ── 2. grid 118 · the exceptions ────────────────────────────────────────────
-- A hand-journalled settlement of a SALES / PURCHASE bill (a Journal, Debit
-- Note or Credit Note whose allocation touches an invoice) is legal and must
-- be VISIBLE, so the accountant can see what bypassed the Receipt / Payment
-- screens in the period.
INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_device_type,
        grid_sort_column, grid_sort_order, grid_sql, grid_status,
        grid_is_deleted, grid_created_by)
SELECT 118,
       'VOUCHER REGISTER - EXCEPTIONS',
       'Register vouchers (Journal, Debit Note, Credit Note) whose bill-wise allocations touch a SALES or PURCHASE bill in the period — a hand-journalled settlement, made visible.',
       'Desktop',
       'Date', 'Descending',
       'SELECT h.avh_voucher_id,' || E'\n' ||
       '       h.avh_company_id,' || E'\n' ||
       '       h.avh_branch_id,' || E'\n' ||
       '       h.avh_acc_year,' || E'\n' ||
       '       vt.vchr_type_name                AS type_name,' || E'\n' ||
       '       h.avh_voucher_refno,' || E'\n' ||
       '       h.avh_voucher_date,' || E'\n' ||
       '       p.led_name                       AS party_name,' || E'\n' ||
       '       b.abl_bill_type,' || E'\n' ||
       '       b.abl_doc_refno                  AS bill_refno,' || E'\n' ||
       '       j.abj_adj_type,' || E'\n' ||
       '       j.abj_amount,' || E'\n' ||
       '       h.avh_voucher_status,' || E'\n' ||
       '       h.avh_remarks' || E'\n' ||
       '  FROM accounts.acc_bill_adjustment j' || E'\n' ||
       '  JOIN accounts.acc_voucher_header h ON h.avh_voucher_id = j.abj_voucher_id AND h.avh_acc_year = j.abj_voucher_acc_year' || E'\n' ||
       '  JOIN accounts.acc_voucher_types  vt ON vt.vchr_type_id = h.avh_voucher_type_id' || E'\n' ||
       '  JOIN accounts.acc_bill_balance   b  ON b.abl_id = j.abj_bill_id AND b.abl_acc_year = j.abj_bill_acc_year' || E'\n' ||
       '  JOIN accounts.acc_ledger_master  p  ON p.led_id = j.abj_party_id' || E'\n' ||
       ' WHERE h.avh_company_id = icompany_id::uuid' || E'\n' ||
       '   AND h.avh_branch_id  = ibranch_id::uuid' || E'\n' ||
       '   AND h.avh_acc_year   = iacc_year::bpchar' || E'\n' ||
       '   AND vt.vchr_type_code IN (''Jrl'', ''DrN'', ''CrN'')' || E'\n' ||
       '   AND b.abl_bill_type IN (''SALES'', ''PURCHASE'')' || E'\n' ||
       '   AND j.abj_is_deleted = false' || E'\n' ||
       '   AND j.abj_reversal_of_id IS NULL' || E'\n' ||
       '   AND h.avh_is_deleted = false' || E'\n' ||
       '   AND (NULLIF(ifrom_date, '''') IS NULL OR h.avh_voucher_date >= NULLIF(ifrom_date, '''')::date)' || E'\n' ||
       '   AND (NULLIF(ito_date,   '''') IS NULL OR h.avh_voucher_date <= NULLIF(ito_date,   '''')::date)' || E'\n' ||
       ' ORDER BY h.avh_voucher_date DESC, h.avh_voucher_refno DESC, j.abj_row_no',
       true, false, 'system'
 WHERE NOT EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_name = 'VOUCHER REGISTER - EXCEPTIONS')
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_id = 118);

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
        ( 1, '#',          8.00, 'Left',   false, false, false, 'Text',     'avh_voucher_id'),
        ( 2, 'Company',    8.00, 'Left',   false, false, false, 'Text',     'avh_company_id'),
        ( 3, 'Branch',     8.00, 'Left',   false, false, false, 'Text',     'avh_branch_id'),
        ( 4, 'Year',       5.00, 'Center', false, false, false, 'Text',     'avh_acc_year'),
        ( 5, 'Type',      12.00, 'Left',   true,  true,  false, 'Text',     'type_name'),
        ( 6, 'Voucher No',11.00, 'Left',   true,  true,  false, 'Text',     'avh_voucher_refno'),
        ( 7, 'Date',       9.00, 'Center', true,  true,  false, 'Date',     'avh_voucher_date'),
        ( 8, 'Party',     20.00, 'Left',   true,  true,  false, 'Text',     'party_name'),
        ( 9, 'Bill Type',  9.00, 'Left',   true,  true,  false, 'Text',     'abl_bill_type'),
        (10, 'Bill',      12.00, 'Left',   true,  true,  false, 'Text',     'bill_refno'),
        (11, 'Adj Type',  11.00, 'Left',   true,  true,  false, 'Text',     'abj_adj_type'),
        (12, 'Amount',    11.00, 'Right',  true,  false, true,  'Currency', 'abj_amount'),
        (13, 'Status',     9.00, 'Center', true,  true,  false, 'Text',     'avh_voucher_status'),
        (14, 'Narration', 18.00, 'Left',   false, false, false, 'Text',     'avh_remarks')
       ) AS v(col_no, col_name, width, align, visible, filterable, total, data_type, field)
 WHERE g.grid_name = 'VOUCHER REGISTER - EXCEPTIONS'
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns c WHERE c.grid_id = g.grid_id);

SELECT setval(pg_get_serial_sequence('fixed.grid_details', 'grid_id'),
              (SELECT MAX(grid_id) FROM fixed.grid_details))
 WHERE pg_get_serial_sequence('fixed.grid_details', 'grid_id') IS NOT NULL;

-- ── 3. ui_tables 39 / 40 · the legs grid and the bill-wise panel ────────────
INSERT INTO fixed.ui_tables
       (ui_tbl_id, ui_tbl_name, ui_tbl_editable, ui_tbl_device_type, ui_tbl_is_active, ui_tbl_is_deleted, ui_tbl_created_by)
SELECT v.id, v.name, true, 'Desktop', true, false, 'system'
  FROM (VALUES (39, 'VOUCHER REGISTER - LEGS'),
               (40, 'VOUCHER REGISTER - BILLWISE')) AS v(id, name)
 WHERE NOT EXISTS (SELECT 1 FROM fixed.ui_tables t WHERE t.ui_tbl_name = v.name)
   AND NOT EXISTS (SELECT 1 FROM fixed.ui_tables t WHERE t.ui_tbl_id = v.id);

-- #, Dr/Cr, Ledger, Group, GST, HSN/SAC, TDS, Debit, Credit, Role, Leg narration, + hidden generated
INSERT INTO fixed.ui_table_columns
       (ui_tbl_clm_no, ui_tbl_clm_table_id, ui_tbl_clm_name, ui_tbl_clm_column_width,
        ui_tbl_clm_column_visibility, ui_tbl_clm_column_position, ui_tbl_clm_column_necessity,
        ui_tbl_clm_created_by)
SELECT v.no, t.ui_tbl_id, v.name, v.width, v.visible, v.no, v.necessity, 'system'
  FROM fixed.ui_tables t
 CROSS JOIN (VALUES
        ( 0, '#',              3.0,  true,  false),
        ( 1, 'Dr/Cr',          4.5,  true,  true),
        ( 2, 'Ledger',        24.0,  true,  true),
        ( 3, 'Group',         12.0,  true,  false),
        ( 4, 'GST',            7.0,  true,  false),
        ( 5, 'HSN/SAC',        7.0,  true,  false),
        ( 6, 'TDS',            3.5,  true,  false),
        ( 7, 'Debit',         10.0,  true,  true),
        ( 8, 'Credit',        10.0,  true,  true),
        ( 9, 'Role',           9.0,  true,  false),
        (10, 'Leg narration', 18.0,  true,  false),
        (11, 'Generated',      0.0,  false, false)
       ) AS v(no, name, width, visible, necessity)
 WHERE t.ui_tbl_name = 'VOUCHER REGISTER - LEGS'
   AND NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns c WHERE c.ui_tbl_clm_table_id = t.ui_tbl_id);

-- bill/ref, date, type, pending, this voucher, due (+ hidden keys)
INSERT INTO fixed.ui_table_columns
       (ui_tbl_clm_no, ui_tbl_clm_table_id, ui_tbl_clm_name, ui_tbl_clm_column_width,
        ui_tbl_clm_column_visibility, ui_tbl_clm_column_position, ui_tbl_clm_column_necessity,
        ui_tbl_clm_created_by)
SELECT v.no, t.ui_tbl_id, v.name, v.width, v.visible, v.no, v.necessity, 'system'
  FROM fixed.ui_tables t
 CROSS JOIN (VALUES
        ( 0, 'Bill / Ref',    12.0, true,  true),
        ( 1, 'Date',           7.0, true,  false),
        ( 2, 'Type',           7.0, true,  false),
        ( 3, 'Pending',        9.0, true,  false),
        ( 4, 'This voucher',   9.0, true,  true),
        ( 5, 'Due',            7.0, true,  false),
        ( 6, 'BillId',         0.0, false, false),
        ( 7, 'BillAccYear',    0.0, false, false),
        ( 8, 'DrCr',           0.0, false, false)
       ) AS v(no, name, width, visible, necessity)
 WHERE t.ui_tbl_name = 'VOUCHER REGISTER - BILLWISE'
   AND NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns c WHERE c.ui_tbl_clm_table_id = t.ui_tbl_id);

SELECT setval(pg_get_serial_sequence('fixed.ui_tables', 'ui_tbl_id'),
              (SELECT MAX(ui_tbl_id) FROM fixed.ui_tables))
 WHERE pg_get_serial_sequence('fixed.ui_tables', 'ui_tbl_id') IS NOT NULL;

COMMIT;

-- ── After running ────────────────────────────────────────────────────────────
-- SELECT grid_id, grid_name FROM fixed.grid_details WHERE grid_id IN (117, 118);
-- SELECT ui_tbl_id, ui_tbl_name FROM fixed.ui_tables WHERE ui_tbl_id IN (39, 40);
