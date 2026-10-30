-- ═══════════════════════════════════════════════════════════════════════════
--  Expense voucher (ExpV) — its list and its print purpose      2026-10-08
--
--  till/plan-till-receipt-payment-expense.md §4.4: "List = a registered grid
--  'EXPENSE VOUCHERS' on TxnMainView. Print = EXPENSE_VOUCHER template."
--  20261008160000 gave ExpV its menu (277); this gives it the two things a
--  TxnMainView screen and its print button look up.
--
--    1 · grid 'MAIN LIST - EXPENSE VOUCHERS' — the payments grid (123) shaped
--        for an expense: who it was paid to (the supplier, else the remarks),
--        the expense heads its lines name (avh_draft_lines, kept after post),
--        the GST bill no, the till session the cash moved in.
--    2 · print_purpose 'EXPENSE_VOUCHER' (ACCOUNTS / ACC_VOUCHER), shipped
--        beside RECEIPT_VOUCHER and PAYMENT_VOUCHER. Like them it has no
--        template yet: one is designed in the template designer and assigned.
--
--  The grid takes id 137 where it is free (133-136 are the till master grids
--  made on the dev box); elsewhere the sequence picks one. The client finds it
--  by NAME (lib/configured-grids/grid-registry.ts), the id is only a fallback.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
--  1 · Grid 'MAIN LIST - EXPENSE VOUCHERS'
--
--  Tokens as grid 123 (send every one, '' = no bound): iavh_company_id,
--  iavh_branch_id, iavh_acc_year, iavh_status, ifrom_date, ito_date.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_device_type,
        grid_sort_column, grid_sort_order, grid_sql, grid_status,
        grid_is_deleted, grid_created_by)
SELECT CASE WHEN EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_id = 137)
            THEN nextval(pg_get_serial_sequence('fixed.grid_details', 'grid_id'))
            ELSE 137 END,
       'MAIN LIST - EXPENSE VOUCHERS',
       'Expense vouchers (ExpV, menu 277) for a company / branch / year: what was spent, on which heads, paid by which tenders.',
       'Desktop',
       'Date', 'Descending',
       'SELECT h.avh_voucher_id,' || E'\n' ||
       '       h.avh_company_id,' || E'\n' ||
       '       h.avh_branch_id,' || E'\n' ||
       '       h.avh_acc_year,' || E'\n' ||
       '       h.avh_voucher_refno,' || E'\n' ||
       '       h.avh_voucher_date,' || E'\n' ||
       '       COALESCE(p.led_name, h.avh_remarks) AS paid_to,' || E'\n' ||
       '       (SELECT string_agg(l.led_name, '', '' ORDER BY (x.e->>''rowNo'')::int)' || E'\n' ||
       '          FROM jsonb_array_elements(COALESCE(h.avh_draft_lines->''lines'', ''[]''::jsonb)) AS x(e)' || E'\n' ||
       '          JOIN accounts.acc_ledger_master l ON l.led_id = (x.e->>''ledgerId'')::uuid) AS expense_heads,' || E'\n' ||
       '       h.avh_doc_amount,' || E'\n' ||
       '       (SELECT string_agg(DISTINCT t.ttm_display_name, '', '' ORDER BY t.ttm_display_name)' || E'\n' ||
       '          FROM accounts.acc_tender_detail d' || E'\n' ||
       '          JOIN accounts.acc_tender_types  t ON t.ttm_type_id = d.td_tender_type_id' || E'\n' ||
       '         WHERE d.td_src_doc_type = ''EXPENSE''' || E'\n' ||
       '           AND d.td_src_doc_id   = h.avh_voucher_id' || E'\n' ||
       '           AND d.td_acc_year     = h.avh_acc_year' || E'\n' ||
       '           AND (d.td_is_deleted = false OR h.avh_voucher_status = ''CANCELLED'')) AS tenders,' || E'\n' ||
       '       h.avh_doc_refno                  AS gst_bill_no,' || E'\n' ||
       '       h.avh_doc_date                   AS gst_bill_date,' || E'\n' ||
       '       s.tss_session_no                 AS session_no,' || E'\n' ||
       '       h.avh_voucher_status,' || E'\n' ||
       '       h.avh_usr_refno,' || E'\n' ||
       '       h.avh_remarks,' || E'\n' ||
       '       rv.avh_voucher_refno             AS reversal_refno,' || E'\n' ||
       '       h.avh_created_by,' || E'\n' ||
       '       h.avh_created_on' || E'\n' ||
       '  FROM accounts.acc_voucher_header h' || E'\n' ||
       '  JOIN accounts.acc_voucher_types  vt ON vt.vchr_type_id = h.avh_voucher_type_id' || E'\n' ||
       '  LEFT JOIN accounts.acc_ledger_master p ON p.led_id = h.avh_party_id' || E'\n' ||
       '  LEFT JOIN accounts.till_session s' || E'\n' ||
       '         ON s.tss_id = h.avh_session_id AND s.tss_acc_year = h.avh_acc_year' || E'\n' ||
       '  LEFT JOIN accounts.acc_voucher_header rv' || E'\n' ||
       '         ON rv.avh_voucher_id = h.avh_reversal_voucher_id' || E'\n' ||
       '        AND rv.avh_acc_year   = h.avh_reversal_acc_year' || E'\n' ||
       ' WHERE h.avh_company_id = iavh_company_id::uuid' || E'\n' ||
       '   AND h.avh_branch_id  = iavh_branch_id::uuid' || E'\n' ||
       '   AND h.avh_acc_year   = iavh_acc_year::bpchar' || E'\n' ||
       '   AND vt.vchr_type_code = ''ExpV''' || E'\n' ||
       '   AND h.avh_is_deleted = false' || E'\n' ||
       '   AND (NULLIF(iavh_status, '''') IS NULL OR h.avh_voucher_status = iavh_status)' || E'\n' ||
       '   AND (NULLIF(ifrom_date, '''') IS NULL OR h.avh_voucher_date::date >= NULLIF(ifrom_date, '''')::date)' || E'\n' ||
       '   AND (NULLIF(ito_date,   '''') IS NULL OR h.avh_voucher_date::date <= NULLIF(ito_date,   '''')::date)' || E'\n' ||
       ' ORDER BY h.avh_voucher_date DESC,' || E'\n' ||
       '         h.avh_voucher_slno DESC NULLS LAST,' || E'\n' ||
       '         h.avh_created_on   DESC',
       true, false, 'system'
 WHERE NOT EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_name = 'MAIN LIST - EXPENSE VOUCHERS');

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
        ( 1, '#',              8.00,  'Left',   false, false, false, 'Text',     'avh_voucher_id'),
        ( 2, 'Company',        8.00,  'Left',   false, false, false, 'Text',     'avh_company_id'),
        ( 3, 'Branch',         8.00,  'Left',   false, false, false, 'Text',     'avh_branch_id'),
        ( 4, 'Year',           5.00,  'Center', false, false, false, 'Text',     'avh_acc_year'),
        ( 5, 'Voucher No',     9.00,  'Left',   true,  true,  false, 'Text',     'avh_voucher_refno'),
        ( 6, 'Date',           9.00,  'Center', true,  true,  false, 'Date',     'avh_voucher_date'),
        ( 7, 'Paid To',       16.00,  'Left',   true,  true,  false, 'Text',     'paid_to'),
        ( 8, 'Expense Heads', 18.00,  'Left',   true,  true,  false, 'Text',     'expense_heads'),
        ( 9, 'Amount',        11.00,  'Right',  true,  false, true,  'Currency', 'avh_doc_amount'),
        (10, 'Tenders',       12.00,  'Left',   true,  true,  false, 'Text',     'tenders'),
        (11, 'GST Bill No',   10.00,  'Left',   true,  true,  false, 'Text',     'gst_bill_no'),
        (12, 'GST Bill Date',  9.00,  'Center', false, false, false, 'Date',     'gst_bill_date'),
        (13, 'Session',        9.00,  'Left',   true,  true,  false, 'Text',     'session_no'),
        (14, 'Status',         9.00,  'Center', true,  true,  false, 'Text',     'avh_voucher_status'),
        (15, 'Your Ref',      10.00,  'Left',   false, false, false, 'Text',     'avh_usr_refno'),
        (16, 'Remarks',       14.00,  'Left',   false, false, false, 'Text',     'avh_remarks'),
        (17, 'Reversal',      12.00,  'Left',   false, false, false, 'Text',     'reversal_refno'),
        (18, 'Created By',    10.00,  'Left',   false, false, false, 'Text',     'avh_created_by'),
        (19, 'Created On',    10.00,  'Center', false, false, false, 'Date',     'avh_created_on')
       ) AS v(col_no, col_name, width, align, visible, filterable, total, data_type, field)
 WHERE g.grid_name = 'MAIN LIST - EXPENSE VOUCHERS'
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns c WHERE c.grid_id = g.grid_id);

SELECT setval(pg_get_serial_sequence('fixed.grid_details', 'grid_id'),
              GREATEST((SELECT max(grid_id) FROM fixed.grid_details),
                       (SELECT last_value FROM fixed.grid_details_grid_id_seq)))
 WHERE pg_get_serial_sequence('fixed.grid_details', 'grid_id') IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════════════
--  2 · print_purpose 'EXPENSE_VOUCHER'
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.print_purpose
       (ppo_code, ppo_name, ppo_src_module, ppo_doc_type, ppo_copy_count,
        ppo_copy_labels, ppo_allow_reprint, ppo_sort_order, ppo_notes,
        ppo_is_active, ppo_is_deleted)
SELECT 'EXPENSE_VOUCHER', 'Expense Voucher', 'ACCOUNTS', 'ACC_VOUCHER', 1,
       'NA', true, 105,
       'An expense paid by tenders (ExpV, /api/v1/expenses/*): the lines (expense ledger, description, taxable, GST), the tenders, and the supplier''s GST bill when one was entered. GET /expenses/get carries the shape.',
       true, false
 WHERE NOT EXISTS (SELECT 1 FROM public.print_purpose
                    WHERE ppo_company_id IS NULL AND lower(ppo_code::text) = 'expense_voucher'
                      AND ppo_is_deleted = false);


-- ── Read-back ──────────────────────────────────────────────────────────────
-- SELECT grid_id, grid_name FROM fixed.grid_details WHERE grid_name = 'MAIN LIST - EXPENSE VOUCHERS';
-- SELECT ppo_code, ppo_src_module, ppo_doc_type FROM public.print_purpose WHERE ppo_code = 'EXPENSE_VOUCHER';
