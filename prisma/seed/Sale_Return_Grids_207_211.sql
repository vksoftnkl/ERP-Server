-- Sale Return (menu 13) — grids 207 to 211, the same rows migration
-- 20261113160000_sale_return_screen writes (plan
-- Shared/Prathap/sales/plan-sale-return-qt-2026-11-13-v5.md §5.5).
--
--   207 "MAIN LIST - SALE RETURNS": the list (TxnMainView), filter chips via ikind / ifilter.
--   208 "POPUP - SALE RETURN BILLS": popup A, the bill picker.
--   209 "POPUP - SALE RETURN APPROVALS": History, Approvals tab (till_approval rows).
--   210 "POPUP - SALE RETURN CREDIT USES": History, Used on tab (where the credit note went).
--   211 "POPUP - SALE RETURN LAST SALES": popup N, a no-bill line's last sales of the item.
--
-- WHY A TARGETED SEED RATHER THAN AN EDIT TO Grid_Details.sql / Grid_Columns.sql
--   Those two are exports (npm run seed:export:ui-config), and Grid_Columns.sql
--   skips any grid that already has a column (precedent:
--   Sale_Order_Entry_Grids_204_205.sql). It runs after both (manifest order).
--
-- The grid_sql text is byte-identical to the migration's and holds no comment
-- marker (the runner refuses one). grid_column ids are pinned (the migration's),
-- so every database ends up with the same rows.
--
-- As 20261114100000_sale_return_grid_fixes left them: 207 has the bill filter
-- ibill_id ('' = every bill, the Sale Bill's returns chip, D62); 210 reads
-- "Adjust at Post" as the server's OWN_ADJUST_AT_POST (a voucher-less
-- NOTE_ADJUST against a DR bill created before the note), not a 5-second window;
-- the money columns of 207 / 208 / 210 / 211 are NumericTS (Qt does not know
-- 'Currency'); 209's hidden Amount is still 'Currency'.
--
-- Idempotent: ON CONFLICT (grid_id) DO NOTHING keeps a grid a site has edited;
-- a column goes in only under a grid of the expected name with no live column of
-- that number. Safe to re-run.
-- Run: psql "$DATABASE_URL" -f prisma/seed/Sale_Return_Grids_207_211.sql
--      or: npm run seed:run -- --only=Sale_Return_Grids_207_211.sql

BEGIN;

INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_sort_column, grid_sort_order, grid_device_type,
        grid_status, grid_is_deleted, grid_created_by, grid_sql)
VALUES
(207, 'MAIN LIST - SALE RETURNS',
 'Sale Return list (menu 13, TxnMainView). Tokens (send every one; '''' = no bound / all): icompany_id, ibranch_id, ifrom_date, ito_date (yyyy-MM-dd), ikind ('''' / RETURN / CLAIM), ifilter ('''' / CLAIMS_WAITING = claims still DRAFT / AWAITING_APPROVAL = latest till_approval PENDING), ibill_id ('''' = every bill; a sale bill''s sb_id = only the returns against that bill: the Sale Bill''s returns chip, D62). Status text adds AWAITING APPROVAL, DRAFT · REJECTED, DRAFT · CLAIM WAITING, POSTED · REVIEW REJECTED from the latest till_approval row of the return. Newest first.',
 'sr_return_date', 'Descending', 'Desktop', true, false, 'system',
$seed$SELECT sr.sr_id, sr.sr_company_id, sr.sr_branch_id, sr.sr_acc_year,
       sr.sr_return_refno, sr.sr_return_date,
       CASE sr.sr_return_kind WHEN 'CLAIM' THEN 'Claim' ELSE 'Return' END AS sr_kind_text,
       sr.sr_cust_name,
       CASE WHEN sr.sr_is_against_bill THEN COALESCE(sr.sr_bill_refno, '') ELSE 'no bill' END AS sr_against,
       sr.sr_tot_items, sr.sr_return_amt,
       CASE sr.sr_settle_mode WHEN 'CASH' THEN 'Refund' WHEN 'ADJUST' THEN 'Adjust'
                              WHEN 'ADVANCE' THEN 'Credit note' ELSE sr.sr_settle_mode END AS sr_settle_by,
       sr.sr_settle_status,
       CASE WHEN sr.sr_status = 'DRAFT' AND ap.tap_status = 'PENDING' THEN 'AWAITING APPROVAL'
            WHEN sr.sr_status = 'DRAFT' AND ap.tap_status = 'REJECTED' THEN 'DRAFT · REJECTED'
            WHEN sr.sr_status = 'DRAFT' AND sr.sr_return_kind = 'CLAIM' THEN 'DRAFT · CLAIM WAITING'
            WHEN sr.sr_status = 'POSTED' AND ap.tap_status = 'REJECTED' THEN 'POSTED · REVIEW REJECTED'
            ELSE sr.sr_status END AS sr_status_text,
       CASE WHEN sr.sr_status = 'DRAFT' THEN ''
            WHEN ei.gde_status = 'NA' THEN 'N/A'
            WHEN ei.gde_status = 'CANCELED' THEN 'CANCELLED'
            WHEN ei.gde_status IS NOT NULL THEN ei.gde_status
            WHEN sr.sr_gst_mode = 'FINANCIAL' THEN 'N/A'
            ELSE 'NOT SENT' END AS sr_irn_status,
       COALESCE(rm.srm_name, sr.sr_return_reason, '') AS sr_reason_text,
       sr.sr_status, sr.sr_return_kind, sr.sr_settle_mode,
       COALESCE(ap.tap_status, '') AS sr_approval_status,
       sr.sr_bill_id, sr.sr_bill_acc_year, sr.sr_cust_id, sr.sr_return_slno, sr.sr_gst_mode
  FROM sales.sale_return sr
  LEFT JOIN stock.stock_reason_master rm ON rm.srm_id = sr.sr_reason_id
  LEFT JOIN LATERAL (SELECT a.tap_status
                       FROM accounts.till_approval a
                      WHERE a.tap_src_doc_type = 'SALE_RETURN'
                        AND a.tap_src_doc_id = sr.sr_id
                        AND a.tap_is_deleted = false
                      ORDER BY a.tap_requested_on DESC
                      LIMIT 1) ap ON true
  LEFT JOIN LATERAL (SELECT e.gde_status::text AS gde_status
                       FROM accounts.acc_voucher_doc_register g
                       JOIN accounts.acc_voucher_doc_einvoice e ON e.gde_gdr_id = g.gdr_id AND e.gde_is_deleted = false
                      WHERE g.gdr_source_doc_id = sr.sr_id
                        AND g.gdr_acc_year = sr.sr_acc_year
                        AND g.gdr_is_deleted = false
                      ORDER BY e.gde_created_on DESC
                      LIMIT 1) ei ON true
 WHERE sr.sr_is_deleted = false
   AND sr.sr_company_id::text = 'icompany_id'
   AND (NULLIF('ibranch_id', '') IS NULL OR sr.sr_branch_id::text = 'ibranch_id')
   AND (NULLIF('ifrom_date', '') IS NULL OR sr.sr_return_date::text >= 'ifrom_date')
   AND (NULLIF('ito_date', '') IS NULL OR sr.sr_return_date::text <= 'ito_date')
   AND (NULLIF('ikind', '') IS NULL OR sr.sr_return_kind = 'ikind')
   AND (NULLIF('ibill_id', '') IS NULL OR sr.sr_bill_id::text = 'ibill_id')
   AND (NULLIF('ifilter', '') IS NULL
        OR ('ifilter' = 'CLAIMS_WAITING' AND sr.sr_return_kind = 'CLAIM' AND sr.sr_status = 'DRAFT')
        OR ('ifilter' = 'AWAITING_APPROVAL' AND ap.tap_status = 'PENDING' AND sr.sr_status <> 'CANCELLED'))
 ORDER BY sr.sr_return_date DESC, sr.sr_return_slno DESC$seed$),
(208, 'POPUP - SALE RETURN BILLS',
 'Sale Return bill picker (menu 13, popup A): POSTED bills with their line count, lines with qty left (base units, D68: the line''s own factor when > 0, else the unit conversion, else 1; POSTED returns only), bill value, returned, still due and age. Tokens (send every one; '''' = no bound / all): icompany_id, ibranch_id, icust_id ('''' = every customer), iall_branches (''true'' = every branch of the company, D14), ihide_full (''true'' = hide bills with no qty left), ifrom_date, ito_date (yyyy-MM-dd). Searches bill no, bill value, customer name and phone.',
 'sb_bill_date', 'Descending', 'Desktop', true, false, 'system',
$seed$SELECT b.sb_id, b.sb_acc_year, b.sb_branch_id, b.sb_cust_id,
       b.sb_bill_refno, b.sb_bill_date,
       COALESCE(b.sb_pay_mode, '') AS sb_paid_by,
       ls.line_count AS sb_line_count,
       ls.open_lines AS sb_open_lines,
       b.sb_bill_amt, b.sb_returned_amt,
       COALESCE(bal.pending, 0) AS sb_still_due,
       (CURRENT_DATE - b.sb_bill_date) AS sb_age_days,
       b.sb_cust_name,
       COALESCE(b.sb_cust_phone, '') AS sb_cust_phone,
       COALESCE(br.br_name, '') AS sb_branch_name,
       COALESCE(b.sb_return_status, '') AS sb_return_status,
       b.sb_company_id
  FROM sales.sale_bill b
  LEFT JOIN public.branch_master br ON br.br_id = b.sb_branch_id
  LEFT JOIN LATERAL (SELECT SUM(a.abl_pending_amount) AS pending
                       FROM accounts.acc_bill_balance a
                      WHERE a.abl_src_doc_type = 'SALE_BILL'
                        AND a.abl_src_doc_id = b.sb_id
                        AND a.abl_acc_year = b.sb_acc_year
                        AND a.abl_is_deleted = false
                        AND a.abl_is_active = true) bal ON true
  CROSS JOIN LATERAL (SELECT count(*) AS line_count,
                             count(*) FILTER (WHERE q.bill_base > q.back_base) AS open_lines
                        FROM (SELECT bi.sbi_bill_qty
                                     * CASE WHEN bi.sbi_to_base_factor > 0 THEN bi.sbi_to_base_factor
                                            ELSE COALESCE(NULLIF(bu.iuc_to_base_factor, 0), 1) END AS bill_base,
                                     COALESCE((SELECT SUM((ri.sri_return_qty + ri.sri_free_qty)
                                                          * CASE WHEN ri.sri_to_base_factor > 0 THEN ri.sri_to_base_factor
                                                                 ELSE COALESCE(NULLIF(ru.iuc_to_base_factor, 0), 1) END)
                                                 FROM sales.sale_return_item ri
                                                 JOIN sales.sale_return r ON r.sr_id = ri.sri_return_id AND r.sr_acc_year = ri.sri_acc_year
                                                 LEFT JOIN inventory.item_unit_conversion ru ON ru.iuc_id = ri.sri_item_unit_id
                                                WHERE ri.sri_bill_item_id = bi.sbi_id
                                                  AND ri.sri_bill_acc_year = bi.sbi_acc_year
                                                  AND ri.sri_is_deleted = false
                                                  AND r.sr_is_deleted = false
                                                  AND r.sr_status = 'POSTED'), 0) AS back_base
                                FROM sales.sale_bill_item bi
                                LEFT JOIN inventory.item_unit_conversion bu ON bu.iuc_id = bi.sbi_item_unit_id
                               WHERE bi.sbi_bill_id = b.sb_id
                                 AND bi.sbi_acc_year = b.sb_acc_year
                                 AND bi.sbi_is_deleted = false) q) ls
 WHERE b.sb_is_deleted = false
   AND b.sb_status = 'POSTED'
   AND b.sb_company_id::text = 'icompany_id'
   AND ('iall_branches' = 'true' OR b.sb_branch_id::text = 'ibranch_id')
   AND (NULLIF('icust_id', '') IS NULL OR b.sb_cust_id::text = 'icust_id')
   AND (NULLIF('ifrom_date', '') IS NULL OR b.sb_bill_date::text >= 'ifrom_date')
   AND (NULLIF('ito_date', '') IS NULL OR b.sb_bill_date::text <= 'ito_date')
   AND ('ihide_full' <> 'true' OR ls.open_lines > 0)
 ORDER BY b.sb_bill_date DESC, b.sb_bill_slno DESC$seed$),
(209, 'POPUP - SALE RETURN APPROVALS',
 'Sale Return History, Approvals tab (D55, D72): the till_approval rows of one return (tap_src_doc_type SALE_RETURN), newest first; times as IST 12-hour text. Tokens: icompany_id, idoc_id (sr_id), iacc_year (accepted, not filtered: an approval is filed in the session''s year, which may be the next one).',
 'tap_sort', 'Descending', 'Desktop', true, false, 'system',
$seed$SELECT a.tap_id, a.tap_acc_year, a.tap_event_code,
       to_char(a.tap_requested_on AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY HH12:MI AM') AS tap_asked_at,
       COALESCE(NULLIF(rq.usr_display_name, ''), rq.usr_login_name, '') AS tap_asked_by,
       COALESCE(a.tap_request_note, '') AS tap_request_note,
       a.tap_status,
       CASE WHEN a.tap_decided_on IS NULL THEN ''
            ELSE to_char(a.tap_decided_on AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY HH12:MI AM') END AS tap_decided_at,
       COALESCE(NULLIF(dc.usr_display_name, ''), dc.usr_login_name, '') AS tap_decided_by,
       COALESCE(a.tap_decision_note, '') AS tap_decision_note,
       a.tap_amount, a.tap_channel, a.tap_required_role,
       to_char(a.tap_requested_on AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI:SS') AS tap_sort
  FROM accounts.till_approval a
  LEFT JOIN public.user_master rq ON rq.usr_id = a.tap_requested_by
  LEFT JOIN public.user_master dc ON dc.usr_id = a.tap_decided_by
 WHERE a.tap_is_deleted = false
   AND a.tap_src_doc_type = 'SALE_RETURN'
   AND a.tap_company_id::text = 'icompany_id'
   AND a.tap_src_doc_id::text = 'idoc_id'
 ORDER BY a.tap_requested_on DESC$seed$),
(210, 'POPUP - SALE RETURN CREDIT USES',
 'Sale Return History, Used on tab (D55): where the credit note went. The live NOTE_ADJUST / ADVANCE_ADJUST rows on the note''s balance row (abl_src_doc_type SALE_RETURN), reversed rows and the rows they reverse left out. How: Receipt (a RECEIPT voucher), Adjust at Post (the note''s own set-off at its post: a voucher-less NOTE_ADJUST against a DR bill created before the note, as the server''s OWN_ADJUST_AT_POST), Bill F4 (any other voucher-less use: a bill raised after the note). Tokens: icompany_id, idoc_id (sr_id), iacc_year (the return''s year).',
 'cu_date', 'Ascending', 'Desktop', true, false, 'system',
$seed$SELECT a.abj_id, a.abj_acc_year,
       CASE WHEN vt.vchr_nature = 'RECEIPT' THEN COALESCE(h.avh_voucher_refno, o.abl_doc_refno, '')
            ELSE COALESCE(o.abl_doc_refno, '') END AS cu_document,
       a.abj_adj_date AS cu_date,
       CASE WHEN vt.vchr_nature = 'RECEIPT' THEN 'Receipt'
            WHEN a.abj_voucher_id IS NULL
                 AND a.abj_adj_type = 'NOTE_ADJUST'
                 AND o.abl_dr_cr = 'DR'
                 AND o.abl_created_on < n.abl_created_on THEN 'Adjust at Post'
            WHEN a.abj_voucher_id IS NULL THEN 'Bill F4'
            ELSE COALESCE(vt.vchr_type_name, initcap(replace(a.abj_adj_type, '_', ' '))) END AS cu_how,
       a.abj_amount AS cu_amount,
       COALESCE(o.abl_doc_refno, '') AS cu_bill_refno,
       COALESCE(o.abl_src_doc_type, '') AS cu_bill_doc_type,
       o.abl_src_doc_id AS cu_bill_doc_id,
       o.abl_src_acc_year AS cu_bill_acc_year,
       COALESCE(h.avh_voucher_refno, '') AS cu_voucher_refno,
       a.abj_adj_type,
       n.abl_pending_amount AS cu_note_left
  FROM accounts.acc_bill_balance n
  JOIN accounts.acc_bill_adjustment a ON a.abj_bill_id = n.abl_id AND a.abj_bill_acc_year = n.abl_acc_year
  LEFT JOIN accounts.acc_bill_balance o ON o.abl_id = a.abj_against_bill_id
  LEFT JOIN accounts.acc_voucher_header h ON h.avh_voucher_id = a.abj_voucher_id
                                         AND h.avh_acc_year = a.abj_voucher_acc_year
  LEFT JOIN accounts.acc_voucher_types vt ON vt.vchr_type_id = h.avh_voucher_type_id
 WHERE n.abl_is_deleted = false
   AND n.abl_src_doc_type = 'SALE_RETURN'
   AND n.abl_company_id::text = 'icompany_id'
   AND n.abl_src_doc_id::text = 'idoc_id'
   AND n.abl_src_acc_year::text = 'iacc_year'
   AND a.abj_is_deleted = false
   AND a.abj_adj_type IN ('NOTE_ADJUST', 'ADVANCE_ADJUST')
   AND a.abj_reversal_of_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM accounts.acc_bill_adjustment x
                    WHERE x.abj_reversal_of_id = a.abj_id AND x.abj_is_deleted = false)
 ORDER BY a.abj_adj_date, a.abj_created_on$seed$),
(211, 'POPUP - SALE RETURN LAST SALES',
 'Sale Return popup N, a no-bill line (D56, D78): one customer''s POSTED bill lines of one item in every branch of the company, newest first. Billed in the line''s unit, Left = billed less POSTED returns (base units, D68) in the line''s unit, Rate paid = the line''s taxable value per BASE unit (after discounts, before tax), GST %, age at the return date, In window Y / N (0 = any date). Tokens (send every one): icompany_id, icust_id, iitem_id, iwindow_days (sales.return_window_days), ireturn_date (yyyy-MM-dd; '''' = today).',
 'sb_bill_date', 'Descending', 'Desktop', true, false, 'system',
$seed$SELECT bi.sbi_id, bi.sbi_acc_year, b.sb_id, b.sb_branch_id,
       b.sb_bill_refno, b.sb_bill_date,
       COALESCE(br.br_name, '') AS sb_branch_name,
       COALESCE(um.unit_name, '') AS unit_name,
       bi.sbi_bill_qty,
       round(GREATEST(f.bill_base - rt.back_base, 0) / f.factor, 3) AS sbi_left_qty,
       CASE WHEN f.bill_base > 0 THEN round(bi.sbi_taxable_amt / f.bill_base, 4) ELSE 0 END AS rate_paid_base,
       bi.sbi_tax_perc,
       (p.return_date - b.sb_bill_date) AS age_days,
       CASE WHEN p.window_days = 0 OR (p.return_date - b.sb_bill_date) <= p.window_days THEN 'Y' ELSE 'N' END AS in_window,
       COALESCE(bum.unit_name, '') AS base_unit_name,
       bi.sbi_item_unit_id, f.factor AS to_base_factor, bi.sbi_tax_id, bi.sbi_lot_id
  FROM sales.sale_bill_item bi
  JOIN sales.sale_bill b ON b.sb_id = bi.sbi_bill_id AND b.sb_acc_year = bi.sbi_acc_year
  LEFT JOIN public.branch_master br ON br.br_id = b.sb_branch_id
  LEFT JOIN inventory.item_unit_conversion bu ON bu.iuc_id = bi.sbi_item_unit_id
  LEFT JOIN inventory.item_unit_master um ON um.unit_id = bu.iuc_unit_id
  LEFT JOIN inventory.item_unit_master bum ON bum.unit_id = bu.iuc_base_unit_id
  CROSS JOIN LATERAL (SELECT x.factor, bi.sbi_bill_qty * x.factor AS bill_base
                        FROM (SELECT CASE WHEN bi.sbi_to_base_factor > 0 THEN bi.sbi_to_base_factor
                                          ELSE COALESCE(NULLIF(bu.iuc_to_base_factor, 0), 1) END AS factor) x) f
  CROSS JOIN LATERAL (SELECT COALESCE(SUM((ri.sri_return_qty + ri.sri_free_qty)
                                          * CASE WHEN ri.sri_to_base_factor > 0 THEN ri.sri_to_base_factor
                                                 ELSE COALESCE(NULLIF(ru.iuc_to_base_factor, 0), 1) END), 0) AS back_base
                        FROM sales.sale_return_item ri
                        JOIN sales.sale_return r ON r.sr_id = ri.sri_return_id AND r.sr_acc_year = ri.sri_acc_year
                        LEFT JOIN inventory.item_unit_conversion ru ON ru.iuc_id = ri.sri_item_unit_id
                       WHERE ri.sri_bill_item_id = bi.sbi_id
                         AND ri.sri_bill_acc_year = bi.sbi_acc_year
                         AND ri.sri_is_deleted = false
                         AND r.sr_is_deleted = false
                         AND r.sr_status = 'POSTED') rt
  CROSS JOIN (SELECT CASE WHEN 'ireturn_date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                          THEN ('ireturn_date'::text)::date ELSE CURRENT_DATE END AS return_date,
                     CASE WHEN 'iwindow_days' ~ '^[0-9]{1,6}$'
                          THEN ('iwindow_days'::text)::integer ELSE 0 END AS window_days) p
 WHERE b.sb_is_deleted = false
   AND bi.sbi_is_deleted = false
   AND b.sb_status = 'POSTED'
   AND b.sb_company_id::text = 'icompany_id'
   AND b.sb_cust_id::text = 'icust_id'
   AND bi.sbi_item_id::text = 'iitem_id'
 ORDER BY b.sb_bill_date DESC, b.sb_bill_slno DESC, bi.sbi_line_no$seed$)
ON CONFLICT (grid_id) DO NOTHING;

INSERT INTO fixed.grid_columns
       (grid_column_id, grid_id, grid_column_number, grid_column_name, grid_column_sql_field_name,
        grid_column_data_type, grid_column_width, grid_column_position, grid_column_alignment,
        grid_column_visibility, grid_column_filter, grid_column_group, grid_column_total,
        grid_column_is_deleted, grid_column_created_by)
SELECT v.id, v.grid, v.no, v.name, v.fld, v.typ, v.width, v.no, v.align, v.visible, v.filter,
       false, false, false, 'system'
  FROM (VALUES
    -- 207 MAIN LIST - SALE RETURNS (mockup v4 F; visible widths add up to 100)
    ('01a1b2c0-2070-7000-8000-000000020701'::uuid, 207::bigint,  1::integer, '#'::text,          'sr_id'::text,              'Text'::text,      0.00::numeric, 'Left'::text,   false::boolean, false::boolean),
    ('01a1b2c0-2070-7000-8000-000000020702', 207,  2, 'Company',      'sr_company_id',      'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2070-7000-8000-000000020703', 207,  3, 'Branch',       'sr_branch_id',       'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2070-7000-8000-000000020704', 207,  4, 'Year',         'sr_acc_year',        'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2070-7000-8000-000000020705', 207,  5, 'Return No',    'sr_return_refno',    'Text',     12.00, 'Left',   true,  true),
    ('01a1b2c0-2070-7000-8000-000000020706', 207,  6, 'Date',         'sr_return_date',     'Date',      7.00, 'Left',   true,  false),
    ('01a1b2c0-2070-7000-8000-000000020707', 207,  7, 'Kind',         'sr_kind_text',       'Text',      5.00, 'Left',   true,  true),
    ('01a1b2c0-2070-7000-8000-000000020708', 207,  8, 'Customer',     'sr_cust_name',       'Text',     15.00, 'Left',   true,  true),
    ('01a1b2c0-2070-7000-8000-000000020709', 207,  9, 'Against',      'sr_against',         'Text',      8.00, 'Left',   true,  true),
    ('01a1b2c0-2070-7000-8000-000000020710', 207, 10, 'Lines',        'sr_tot_items',       'Number',    4.00, 'Right',  true,  false),
    ('01a1b2c0-2070-7000-8000-000000020711', 207, 11, 'Credit note',  'sr_return_amt',      'NumericTS',  8.00, 'Right',  true,  true),
    ('01a1b2c0-2070-7000-8000-000000020712', 207, 12, 'Settled by',   'sr_settle_by',       'Text',      7.00, 'Left',   true,  false),
    ('01a1b2c0-2070-7000-8000-000000020713', 207, 13, 'Settle',       'sr_settle_status',   'Text',      7.00, 'Center', true,  false),
    ('01a1b2c0-2070-7000-8000-000000020714', 207, 14, 'Status',       'sr_status_text',     'Text',     12.00, 'Center', true,  true),
    ('01a1b2c0-2070-7000-8000-000000020715', 207, 15, 'IRN',          'sr_irn_status',      'Text',      6.00, 'Center', true,  false),
    ('01a1b2c0-2070-7000-8000-000000020716', 207, 16, 'Reason',       'sr_reason_text',     'Text',      9.00, 'Left',   true,  true),
    ('01a1b2c0-2070-7000-8000-000000020717', 207, 17, 'Status code',  'sr_status',          'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2070-7000-8000-000000020718', 207, 18, 'Kind code',    'sr_return_kind',     'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2070-7000-8000-000000020719', 207, 19, 'Settle mode',  'sr_settle_mode',     'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2070-7000-8000-000000020720', 207, 20, 'Approval',     'sr_approval_status', 'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2070-7000-8000-000000020721', 207, 21, 'Bill id',      'sr_bill_id',         'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2070-7000-8000-000000020722', 207, 22, 'Bill year',    'sr_bill_acc_year',   'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2070-7000-8000-000000020723', 207, 23, 'Customer id',  'sr_cust_id',         'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2070-7000-8000-000000020724', 207, 24, 'Slno',         'sr_return_slno',     'Number',    0.00, 'Right',  false, false),
    ('01a1b2c0-2070-7000-8000-000000020725', 207, 25, 'GST mode',     'sr_gst_mode',        'Text',      0.00, 'Left',   false, false),
    -- 208 POPUP - SALE RETURN BILLS (mockup v5 A)
    ('01a1b2c0-2080-7000-8000-000000020801', 208,  1, '#',            'sb_id',              'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2080-7000-8000-000000020802', 208,  2, 'Year',         'sb_acc_year',        'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2080-7000-8000-000000020803', 208,  3, 'Branch id',    'sb_branch_id',       'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2080-7000-8000-000000020804', 208,  4, 'Customer id',  'sb_cust_id',         'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2080-7000-8000-000000020805', 208,  5, 'Bill No',      'sb_bill_refno',      'Text',     16.00, 'Left',   true,  true),
    ('01a1b2c0-2080-7000-8000-000000020806', 208,  6, 'Date',         'sb_bill_date',       'Date',     12.00, 'Left',   true,  false),
    ('01a1b2c0-2080-7000-8000-000000020807', 208,  7, 'Paid by',      'sb_paid_by',         'Text',     10.00, 'Left',   true,  false),
    ('01a1b2c0-2080-7000-8000-000000020808', 208,  8, 'Lines',        'sb_line_count',      'Number',    7.00, 'Right',  true,  false),
    ('01a1b2c0-2080-7000-8000-000000020809', 208,  9, 'Open',         'sb_open_lines',      'Number',    7.00, 'Right',  true,  false),
    ('01a1b2c0-2080-7000-8000-000000020810', 208, 10, 'Bill value',   'sb_bill_amt',        'NumericTS', 14.00, 'Right',  true,  true),
    ('01a1b2c0-2080-7000-8000-000000020811', 208, 11, 'Returned',     'sb_returned_amt',    'NumericTS', 13.00, 'Right',  true,  false),
    ('01a1b2c0-2080-7000-8000-000000020812', 208, 12, 'Still due',    'sb_still_due',       'NumericTS', 14.00, 'Right',  true,  false),
    ('01a1b2c0-2080-7000-8000-000000020813', 208, 13, 'Age',          'sb_age_days',        'Number',    7.00, 'Right',  true,  false),
    ('01a1b2c0-2080-7000-8000-000000020814', 208, 14, 'Customer',     'sb_cust_name',       'Text',      0.00, 'Left',   false, true),
    ('01a1b2c0-2080-7000-8000-000000020815', 208, 15, 'Phone',        'sb_cust_phone',      'Text',      0.00, 'Left',   false, true),
    ('01a1b2c0-2080-7000-8000-000000020816', 208, 16, 'Branch',       'sb_branch_name',     'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2080-7000-8000-000000020817', 208, 17, 'Return status','sb_return_status',   'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2080-7000-8000-000000020818', 208, 18, 'Company',      'sb_company_id',      'Text',      0.00, 'Left',   false, false),
    -- 209 POPUP - SALE RETURN APPROVALS (mockup v5 H, Approvals)
    ('01a1b2c0-2090-7000-8000-000000020901', 209,  1, '#',            'tap_id',             'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2090-7000-8000-000000020902', 209,  2, 'Year',         'tap_acc_year',       'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2090-7000-8000-000000020903', 209,  3, 'Rule',         'tap_event_code',     'Text',     16.00, 'Left',   true,  true),
    ('01a1b2c0-2090-7000-8000-000000020904', 209,  4, 'Asked',        'tap_asked_at',       'Text',     14.00, 'Left',   true,  false),
    ('01a1b2c0-2090-7000-8000-000000020905', 209,  5, 'By',           'tap_asked_by',       'Text',     10.00, 'Left',   true,  true),
    ('01a1b2c0-2090-7000-8000-000000020906', 209,  6, 'Request note', 'tap_request_note',   'Text',     16.00, 'Left',   true,  true),
    ('01a1b2c0-2090-7000-8000-000000020907', 209,  7, 'Status',       'tap_status',         'Text',      9.00, 'Center', true,  false),
    ('01a1b2c0-2090-7000-8000-000000020908', 209,  8, 'Decided',      'tap_decided_at',     'Text',     14.00, 'Left',   true,  false),
    ('01a1b2c0-2090-7000-8000-000000020909', 209,  9, 'Decided by',   'tap_decided_by',     'Text',     10.00, 'Left',   true,  true),
    ('01a1b2c0-2090-7000-8000-000000020910', 209, 10, 'Note',         'tap_decision_note',  'Text',     11.00, 'Left',   true,  true),
    ('01a1b2c0-2090-7000-8000-000000020911', 209, 11, 'Amount',       'tap_amount',         'Currency',  0.00, 'Right',  false, false),
    ('01a1b2c0-2090-7000-8000-000000020912', 209, 12, 'Channel',      'tap_channel',        'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2090-7000-8000-000000020913', 209, 13, 'Role',         'tap_required_role',  'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2090-7000-8000-000000020914', 209, 14, 'Sort',         'tap_sort',           'Text',      0.00, 'Left',   false, false),
    -- 210 POPUP - SALE RETURN CREDIT USES (mockup v5 H, Used on)
    ('01a1b2c0-2100-7000-8000-000000021001', 210,  1, '#',            'abj_id',             'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2100-7000-8000-000000021002', 210,  2, 'Year',         'abj_acc_year',       'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2100-7000-8000-000000021003', 210,  3, 'Document',     'cu_document',        'Text',     30.00, 'Left',   true,  true),
    ('01a1b2c0-2100-7000-8000-000000021004', 210,  4, 'Date',         'cu_date',            'Date',     15.00, 'Left',   true,  false),
    ('01a1b2c0-2100-7000-8000-000000021005', 210,  5, 'How',          'cu_how',             'Text',     25.00, 'Left',   true,  true),
    ('01a1b2c0-2100-7000-8000-000000021006', 210,  6, 'Amount',       'cu_amount',          'NumericTS', 30.00, 'Right',  true,  false),
    ('01a1b2c0-2100-7000-8000-000000021007', 210,  7, 'Bill',         'cu_bill_refno',      'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2100-7000-8000-000000021008', 210,  8, 'Bill type',    'cu_bill_doc_type',   'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2100-7000-8000-000000021009', 210,  9, 'Bill id',      'cu_bill_doc_id',     'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2100-7000-8000-000000021010', 210, 10, 'Bill year',    'cu_bill_acc_year',   'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2100-7000-8000-000000021011', 210, 11, 'Voucher',      'cu_voucher_refno',   'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2100-7000-8000-000000021012', 210, 12, 'Adj type',     'abj_adj_type',       'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2100-7000-8000-000000021013', 210, 13, 'Left on note', 'cu_note_left',       'NumericTS',  0.00, 'Right',  false, false),
    -- 211 POPUP - SALE RETURN LAST SALES (mockup v5 N)
    ('01a1b2c0-2110-7000-8000-000000021101', 211,  1, '#',            'sbi_id',             'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2110-7000-8000-000000021102', 211,  2, 'Year',         'sbi_acc_year',       'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2110-7000-8000-000000021103', 211,  3, 'Bill id',      'sb_id',              'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2110-7000-8000-000000021104', 211,  4, 'Branch id',    'sb_branch_id',       'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2110-7000-8000-000000021105', 211,  5, 'Bill',         'sb_bill_refno',      'Text',     14.00, 'Left',   true,  true),
    ('01a1b2c0-2110-7000-8000-000000021106', 211,  6, 'Date',         'sb_bill_date',       'Date',     12.00, 'Left',   true,  false),
    ('01a1b2c0-2110-7000-8000-000000021107', 211,  7, 'Branch',       'sb_branch_name',     'Text',     14.00, 'Left',   true,  true),
    ('01a1b2c0-2110-7000-8000-000000021108', 211,  8, 'Unit',         'unit_name',          'Text',      8.00, 'Left',   true,  false),
    ('01a1b2c0-2110-7000-8000-000000021109', 211,  9, 'Billed',       'sbi_bill_qty',       'Number',    8.00, 'Right',  true,  false),
    ('01a1b2c0-2110-7000-8000-000000021110', 211, 10, 'Left',         'sbi_left_qty',       'Number',    8.00, 'Right',  true,  false),
    ('01a1b2c0-2110-7000-8000-000000021111', 211, 11, 'Rate paid',    'rate_paid_base',     'NumericTS', 12.00, 'Right',  true,  false),
    ('01a1b2c0-2110-7000-8000-000000021112', 211, 12, 'GST %',        'sbi_tax_perc',       'Number',    7.00, 'Right',  true,  false),
    ('01a1b2c0-2110-7000-8000-000000021113', 211, 13, 'Age',          'age_days',           'Number',    7.00, 'Right',  true,  false),
    ('01a1b2c0-2110-7000-8000-000000021114', 211, 14, 'In window',    'in_window',          'Text',     10.00, 'Center', true,  false),
    ('01a1b2c0-2110-7000-8000-000000021115', 211, 15, 'Base unit',    'base_unit_name',     'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2110-7000-8000-000000021116', 211, 16, 'Unit id',      'sbi_item_unit_id',   'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2110-7000-8000-000000021117', 211, 17, 'Factor',       'to_base_factor',     'Number',    0.00, 'Right',  false, false),
    ('01a1b2c0-2110-7000-8000-000000021118', 211, 18, 'Tax id',       'sbi_tax_id',         'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2110-7000-8000-000000021119', 211, 19, 'Lot id',       'sbi_lot_id',         'Text',      0.00, 'Left',   false, false)
  ) AS v(id, grid, no, name, fld, typ, width, align, visible, filter)
 WHERE EXISTS (SELECT 1 FROM fixed.grid_details g
                WHERE g.grid_id = v.grid
                  AND g.grid_name IN ('MAIN LIST - SALE RETURNS', 'POPUP - SALE RETURN BILLS',
                                      'POPUP - SALE RETURN APPROVALS', 'POPUP - SALE RETURN CREDIT USES',
                                      'POPUP - SALE RETURN LAST SALES'))
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns c
                    WHERE c.grid_id = v.grid AND c.grid_column_number = v.no AND c.grid_column_is_deleted = false)
ON CONFLICT (grid_column_id) DO NOTHING;

-- Keep the identity sequence ahead of the seeded ids.
SELECT setval(
    pg_get_serial_sequence('fixed.grid_details', 'grid_id'),
    (SELECT GREATEST(COALESCE(MAX(grid_id), 0), 1) FROM fixed.grid_details),
    true
);

COMMIT;
