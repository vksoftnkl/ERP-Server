-- ═══════════════════════════════════════════════════════════════════════════
--  Sale Return (menu 13): five registration fixes after P1          2026-11-14
--  Plan: Shared/Prathap/sales/plan-sale-return-qt-2026-11-13-v5.md §5.5 /
--  §5.6 (the user's OK for these five, 2026-11-14). Follows
--  20261113160000_sale_return_screen (applied; not edited).
--  Config rows only: no table, column, index, CHECK, function or trigger, so
--  db_table_master, ensure_acc_year_partitions and the Prisma fragments are
--  not touched.
--
--   1 · grid 207 "MAIN LIST - SALE RETURNS": a bill filter, token ibill_id
--       ('' = every bill; a sale bill's sb_id = only the returns against
--       that bill), so the Sale Bill's returns chip opens the list filtered
--       to the bill (D62). Written like every optional id token:
--       (NULLIF('ibill_id', '') IS NULL OR sr.sr_bill_id::text = 'ibill_id').
--       Like grid 207's other tokens it must always be sent: an unsent token
--       stays in the statement as its own name and the list comes back empty.
--   2 · grid 210 "POPUP - SALE RETURN CREDIT USES": "Adjust at Post" is no
--       longer read off a 5-second window around the note's own time (a later
--       return's post re-stamps the note's set-off rows, S2). It is now the
--       server's OWN_ADJUST_AT_POST (sale-return.service.ts adjustedAtPost /
--       creditApplied / adjustedBills): a voucher-less NOTE_ADJUST against a
--       DR receivable created before the note. Any other voucher-less row is
--       "Bill F4".
--   3 · ui_table 22 "SALE BILL - LINES": Description 17.08 -> 15.55, so the
--       shown widths add up to 100.00 again with column 100 Returned (3.80).
--       Only on the layout it was measured on (Description 17.08, Returned
--       shown); any other layout of table 22 is left alone.
--   4 · grids 207, 208, 210, 211: the money columns from 'Currency', which
--       the Qt NexApiTableView does not know (it showed the raw text), to
--       'NumericTS' (2 decimals, thousands separator), as grids 83 / 85 / 95.
--       Rate paid (211) keeps its 4 decimals in the row: only the shown text
--       is rounded, so "Use rate" still takes the full rate.
--   5 · ui_table 75 "SALE RETURN - CHARGES": Kind 15.00 -> 19.00, so "after
--       tax · fixed, by value" is no longer cut; its two neighbours give the
--       room, Charge 18.00 -> 15.00 and On the bill 10.00 -> 9.00. The shown
--       widths still add up to 95.00 (the row gutter, as tables 69 / 70).
--       All three move together or not at all.
--
--  Only a value still as shipped moves: a grid SQL compared with its white
--  space folded, a width or data type equal to P1's. Nothing runs when a grid
--  or ui table is absent or has another name. Re-running the file changes
--  nothing. The grid SQL holds no comment marker. The same rows are in
--  prisma/seed/Sale_Return_Grids_207_211.sql (grids) and
--  prisma/seed/Ui_Table_Columns.sql (table 75; table 22's seeded layout is a
--  different one, see that file's header).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · grid 207: the bill filter (ibill_id) ──────────────────────────────
UPDATE fixed.grid_details g
   SET grid_sql = $new207$SELECT sr.sr_id, sr.sr_company_id, sr.sr_branch_id, sr.sr_acc_year,
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
 ORDER BY sr.sr_return_date DESC, sr.sr_return_slno DESC$new207$,
       grid_description = $d207$Sale Return list (menu 13, TxnMainView). Tokens (send every one; '' = no bound / all): icompany_id, ibranch_id, ifrom_date, ito_date (yyyy-MM-dd), ikind ('' / RETURN / CLAIM), ifilter ('' / CLAIMS_WAITING = claims still DRAFT / AWAITING_APPROVAL = latest till_approval PENDING), ibill_id ('' = every bill; a sale bill's sb_id = only the returns against that bill: the Sale Bill's returns chip, D62). Status text adds AWAITING APPROVAL, DRAFT · REJECTED, DRAFT · CLAIM WAITING, POSTED · REVIEW REJECTED from the latest till_approval row of the return. Newest first.$d207$,
       grid_modified_by = 'system',
       grid_modified_on = now()
 WHERE g.grid_id = 207
   AND g.grid_name = 'MAIN LIST - SALE RETURNS'
   AND regexp_replace(g.grid_sql, '\s+', ' ', 'g') = regexp_replace($old207$SELECT sr.sr_id, sr.sr_company_id, sr.sr_branch_id, sr.sr_acc_year,
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
   AND (NULLIF('ifilter', '') IS NULL
        OR ('ifilter' = 'CLAIMS_WAITING' AND sr.sr_return_kind = 'CLAIM' AND sr.sr_status = 'DRAFT')
        OR ('ifilter' = 'AWAITING_APPROVAL' AND ap.tap_status = 'PENDING' AND sr.sr_status <> 'CANCELLED'))
 ORDER BY sr.sr_return_date DESC, sr.sr_return_slno DESC$old207$, '\s+', ' ', 'g');

-- ── 2 · grid 210: "Adjust at Post" as the server reads it ─────────────────
UPDATE fixed.grid_details g
   SET grid_sql = $new210$SELECT a.abj_id, a.abj_acc_year,
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
 ORDER BY a.abj_adj_date, a.abj_created_on$new210$,
       grid_description = $d210$Sale Return History, Used on tab (D55): where the credit note went. The live NOTE_ADJUST / ADVANCE_ADJUST rows on the note's balance row (abl_src_doc_type SALE_RETURN), reversed rows and the rows they reverse left out. How: Receipt (a RECEIPT voucher), Adjust at Post (the note's own set-off at its post: a voucher-less NOTE_ADJUST against a DR bill created before the note, as the server's OWN_ADJUST_AT_POST), Bill F4 (any other voucher-less use: a bill raised after the note). Tokens: icompany_id, idoc_id (sr_id), iacc_year (the return's year).$d210$,
       grid_modified_by = 'system',
       grid_modified_on = now()
 WHERE g.grid_id = 210
   AND g.grid_name = 'POPUP - SALE RETURN CREDIT USES'
   AND regexp_replace(g.grid_sql, '\s+', ' ', 'g') = regexp_replace($old210$SELECT a.abj_id, a.abj_acc_year,
       CASE WHEN vt.vchr_nature = 'RECEIPT' THEN COALESCE(h.avh_voucher_refno, o.abl_doc_refno, '')
            ELSE COALESCE(o.abl_doc_refno, '') END AS cu_document,
       a.abj_adj_date AS cu_date,
       CASE WHEN vt.vchr_nature = 'RECEIPT' THEN 'Receipt'
            WHEN a.abj_voucher_id IS NULL
                 AND a.abj_created_on BETWEEN n.abl_created_on - interval '5 seconds'
                                          AND n.abl_created_on + interval '5 seconds' THEN 'Adjust at Post'
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
 ORDER BY a.abj_adj_date, a.abj_created_on$old210$, '\s+', ' ', 'g');

-- ── 3 · ui_table 22: Description 17.08 -> 15.55 ───────────────────────────
UPDATE fixed.ui_table_columns c
   SET ui_tbl_clm_column_width = 15.55,
       ui_tbl_clm_modified_by  = 'system',
       ui_tbl_clm_modified_on  = now()
  FROM fixed.ui_tables t
 WHERE t.ui_tbl_id = 22
   AND t.ui_tbl_name = 'SALE BILL - LINES'
   AND c.ui_tbl_clm_table_id = t.ui_tbl_id
   AND c.ui_tbl_clm_no = 3
   AND c.ui_tbl_clm_name = 'Description'
   AND c.ui_tbl_clm_is_deleted = false
   AND c.ui_tbl_clm_column_width = 17.08
   AND EXISTS (SELECT 1 FROM fixed.ui_table_columns r
                WHERE r.ui_tbl_clm_table_id = 22 AND r.ui_tbl_clm_no = 100
                  AND r.ui_tbl_clm_is_deleted = false AND r.ui_tbl_clm_column_visibility);

-- ── 4 · grids 207 / 208 / 210 / 211: money columns 'Currency' -> 'NumericTS'
UPDATE fixed.grid_columns c
   SET grid_column_data_type   = 'NumericTS',
       grid_column_modified_by = 'system',
       grid_column_modified_on = now()
  FROM fixed.grid_details g,
       (VALUES ('01a1b2c0-2070-7000-8000-000000020711'::uuid, 207::bigint, 'MAIN LIST - SALE RETURNS'::text,        'sr_return_amt'::text),
               ('01a1b2c0-2080-7000-8000-000000020810',       208,         'POPUP - SALE RETURN BILLS',             'sb_bill_amt'),
               ('01a1b2c0-2080-7000-8000-000000020811',       208,         'POPUP - SALE RETURN BILLS',             'sb_returned_amt'),
               ('01a1b2c0-2080-7000-8000-000000020812',       208,         'POPUP - SALE RETURN BILLS',             'sb_still_due'),
               ('01a1b2c0-2100-7000-8000-000000021006',       210,         'POPUP - SALE RETURN CREDIT USES',       'cu_amount'),
               ('01a1b2c0-2100-7000-8000-000000021013',       210,         'POPUP - SALE RETURN CREDIT USES',       'cu_note_left'),
               ('01a1b2c0-2110-7000-8000-000000021111',       211,         'POPUP - SALE RETURN LAST SALES',        'rate_paid_base')
       ) AS v(id, grid, grid_name, field)
 WHERE g.grid_id = v.grid
   AND g.grid_name = v.grid_name
   AND c.grid_id = g.grid_id
   AND c.grid_column_id = v.id
   AND c.grid_column_sql_field_name = v.field
   AND c.grid_column_is_deleted = false
   AND c.grid_column_data_type = 'Currency';

-- ── 5 · ui_table 75: Kind 19.00, Charge 15.00, On the bill 9.00 (95.00) ───
WITH w(no, name, old_width, new_width) AS (
    VALUES (1::bigint,  'Charge'::text,      18.00::numeric, 15.00::numeric),
           (27,         'Kind',              15.00,          19.00),
           (33,         'On the bill',       10.00,           9.00)
), shipped AS (
    SELECT count(*) AS n
      FROM fixed.ui_table_columns k
      JOIN w ON w.no = k.ui_tbl_clm_no AND w.name = k.ui_tbl_clm_name AND w.old_width = k.ui_tbl_clm_column_width
     WHERE k.ui_tbl_clm_table_id = 75 AND k.ui_tbl_clm_is_deleted = false
)
UPDATE fixed.ui_table_columns c
   SET ui_tbl_clm_column_width = w.new_width,
       ui_tbl_clm_modified_by  = 'system',
       ui_tbl_clm_modified_on  = now()
  FROM w, shipped, fixed.ui_tables t
 WHERE t.ui_tbl_id = 75
   AND t.ui_tbl_name = 'SALE RETURN - CHARGES'
   AND shipped.n = 3
   AND c.ui_tbl_clm_table_id = t.ui_tbl_id
   AND c.ui_tbl_clm_no = w.no
   AND c.ui_tbl_clm_name = w.name
   AND c.ui_tbl_clm_is_deleted = false
   AND c.ui_tbl_clm_column_width = w.old_width;

-- ── Check after apply ─────────────────────────────────────────────────────
-- SELECT position('ibill_id' IN grid_sql) > 0 FROM fixed.grid_details WHERE grid_id = 207;          -> t
-- SELECT grid_sql LIKE '%5 seconds%', grid_sql LIKE '%o.abl_created_on < n.abl_created_on%'
--   FROM fixed.grid_details WHERE grid_id = 210;                                                    -> f, t
-- SELECT grid_id, grid_column_sql_field_name, grid_column_data_type FROM fixed.grid_columns
--  WHERE grid_id BETWEEN 207 AND 211 AND grid_column_data_type IN ('Currency', 'NumericTS');
--   -> 207 / 208 / 210 / 211 NumericTS; 209 tap_amount (hidden) still Currency
-- SELECT ui_tbl_clm_table_id, round(sum(ui_tbl_clm_column_width), 2) FROM fixed.ui_table_columns
--  WHERE ui_tbl_clm_table_id IN (22, 75) AND ui_tbl_clm_is_deleted = false
--    AND ui_tbl_clm_column_visibility GROUP BY 1;                                                  -> 22: 100.00, 75: 95.00
