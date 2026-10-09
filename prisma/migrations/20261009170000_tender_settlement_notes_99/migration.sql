-- ═══════════════════════════════════════════════════════════════════════════
--  Tender settlement lists — notes 99 (the till flow test of 2026-10-09)
--
--  §3 · Times in IST. The grid runner sends a timestamptz as a UTC instant
--       ("…T09:40:00.000Z"), and the client shows its clock face as it stands,
--       so a 15:10 IST statement line read 09:40. Every timestamptz these
--       lists return now leaves as IST text WITH its offset
--       ("2026-10-09T15:10:00+05:30"): right whether the client honours the
--       offset or drops it, still sortable as text. Grid 140's dates are
--       `date` columns, which already leave as 'YYYY-MM-DD' (PgService), so it
--       needs none of this.
--         MAIN LIST - TENDER SETTLEMENTS      asi_imported_on
--         TENDER SETTLEMENT - LINES           asl_txn_on
--         TENDER SETTLEMENT - UNEXPLAINED     asl_txn_on
--         TENDER SETTLEMENT - DUPLICATE REFS  td_created_on
--
--  §4 · NOT RECEIVED dropped a row with no expected date (`NULL + grace <
--       current_date` is NULL): a PENDING row the client saved before REV 2
--       §2.4 — the three UPI123 order advances of 2026-09-24 — could never be
--       listed or written off. Such a row is now due from its document date.
--
--  §4 · TENDER SETTLEMENT - PICK ROW (new): the rows a statement line of one
--       kind may take, as the matcher judges them (settlement-match.ts
--       kindTakes, TenderSettlementService.assertTdFree) — SALE a money-in row
--       PENDING / PARTIAL, REFUND a money-out one, CHARGEBACK a money-in row
--       SETTLED / PARTIAL — of a POSTED document, not held by another line of
--       that kind. It is the Match tab's "Pick row" and Resolve LINKED's
--       picker: NOT RECEIVED only lists rows past their date and money-in, so
--       a fresh row, a refund or a chargeback could not be picked from it.
--       Tokens: itd_company_id, itd_branch_id, itender_id ('' = any),
--       iline_kind (SALE | REFUND | CHARGEBACK, '' = SALE), ifrom_date,
--       ito_date ('' = no bound, on the document date). Send every one.
--
--  §5 · INCOME LEDGERS (new dropdown): what /tender-settlement/resolve INCOME
--       accepts as incomeLedgerId — a live ledger under an Income group at any
--       level, the company's or shared. Dropdown 66 (TILL REASON LEDGERS) also
--       lists EXPENSE ledgers, which that route refuses. Param icompany_id,
--       always sent. Id 69 where free, else the next one.
--
--  §2 · Backfill: the sales rows a TSet settled before the TSet wrote
--       td_mdr_amt get the line's fee + tax (TenderSettlementService does it
--       for every later payout).
--
--  The lists are matched by NAME (the client finds a grid by name); a grid
--  edited locally since keeps its SQL (each swap needs the shipped text).
--  Re-runnable.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── §3 · timestamps as IST ─────────────────────────────────────────────────

UPDATE fixed.grid_details
   SET grid_sql = replace(grid_sql,
         '       i.asi_imported_on,',
         '       to_char(i.asi_imported_on AT TIME ZONE ''Asia/Kolkata'', ''YYYY-MM-DD"T"HH24:MI:SS"+05:30"'') AS asi_imported_on,'),
       grid_modified_on = now(), grid_modified_by = 'migration 20261009170000'
 WHERE grid_name = 'MAIN LIST - TENDER SETTLEMENTS'
   AND grid_sql LIKE '%       i.asi_imported_on,%';

UPDATE fixed.grid_details
   SET grid_sql = replace(grid_sql,
         '       l.asl_txn_on,',
         '       to_char(l.asl_txn_on AT TIME ZONE ''Asia/Kolkata'', ''YYYY-MM-DD"T"HH24:MI:SS"+05:30"'') AS asl_txn_on,'),
       grid_modified_on = now(), grid_modified_by = 'migration 20261009170000'
 WHERE grid_name IN ('TENDER SETTLEMENT - LINES', 'TENDER SETTLEMENT - UNEXPLAINED')
   AND grid_sql LIKE '%       l.asl_txn_on,%';

UPDATE fixed.grid_details
   SET grid_sql = replace(grid_sql,
         $o$       k.td_created_on
  FROM keyed k$o$,
         $n$       to_char(k.td_created_on AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"') AS td_created_on
  FROM keyed k$n$),
       grid_modified_on = now(), grid_modified_by = 'migration 20261009170000'
 WHERE grid_name = 'TENDER SETTLEMENT - DUPLICATE REFS'
   AND grid_sql LIKE $l$%       k.td_created_on
  FROM keyed k%$l$;


-- ── §4 · NOT RECEIVED: a row with no expected date is due from its document date ──

UPDATE fixed.grid_details
   SET grid_sql = replace(replace(replace(grid_sql,
         '       (current_date - t.td_expected_settle_on)     AS days_overdue,',
         '       (current_date - COALESCE(t.td_expected_settle_on, t.td_doc_date)) AS days_overdue,'),
         '   AND t.td_expected_settle_on + COALESCE(NULLIF(igrace_days, '''')::int, 2) < current_date',
         '   AND COALESCE(t.td_expected_settle_on, t.td_doc_date) + COALESCE(NULLIF(igrace_days, '''')::int, 2) < current_date'),
         ' ORDER BY t.td_expected_settle_on, t.td_doc_date',
         ' ORDER BY COALESCE(t.td_expected_settle_on, t.td_doc_date), t.td_doc_date'),
       grid_description = 'Non-cash plan §6.1: card / UPI / wallet rows of POSTED documents still PENDING (or PARTIAL) past the expected settlement + grace days (igrace_days, '''' = 2). A row with no expected date (saved PENDING by the client) is due from its document date.',
       grid_modified_on = now(), grid_modified_by = 'migration 20261009170000'
 WHERE grid_name = 'TENDER SETTLEMENT - NOT RECEIVED'
   AND grid_sql LIKE '%   AND t.td_expected_settle_on + COALESCE(NULLIF(igrace_days, '''')::int, 2) < current_date%';


-- ── §4 · TENDER SETTLEMENT - PICK ROW ──────────────────────────────────────

INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_device_type,
        grid_sort_column, grid_sort_order, grid_sql, grid_status,
        grid_is_deleted, grid_created_by)
SELECT nextval(pg_get_serial_sequence('fixed.grid_details', 'grid_id')),
       'TENDER SETTLEMENT - PICK ROW',
       'Non-cash plan §5.4: the tender rows a statement line of one kind (iline_kind SALE | REFUND | CHARGEBACK, '''' = SALE) may be matched or linked to — as the matcher judges them, of POSTED documents, not held by another line of that kind. Optional itender_id, ifrom_date, ito_date ('''' = none).',
       'Desktop', 'Date', 'Descending',
$g$SELECT t.td_id,
       t.td_acc_year,
       m.tnd_name                                   AS tender_name,
       t.td_doc_date,
       to_char(t.td_created_on AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"') AS td_created_on,
       t.td_src_doc_type,
       COALESCE(b.sb_bill_refno, r.sr_return_refno, h.avh_voucher_refno) AS doc_refno,
       s.tss_session_no                             AS session_no,
       u.usr_login_name                             AS cashier,
       t.td_dr_cr,
       t.td_total_amt,
       t.td_settle_amount,
       (t.td_total_amt - COALESCE(t.td_settle_amount, 0)) AS outstanding,
       t.td_ref_no,
       t.td_auth_code,
       t.td_card_last4,
       t.td_payer_vpa,
       t.td_settle_status,
       t.td_expected_settle_on
  FROM accounts.acc_tender_detail t
  JOIN accounts.acc_tender_master m ON m.tnd_id = t.td_tender_id
  LEFT JOIN sales.sale_bill b
         ON t.td_src_doc_type = 'SALE_BILL' AND b.sb_id = t.td_src_doc_id AND b.sb_acc_year = t.td_acc_year
  LEFT JOIN sales.sale_return r
         ON t.td_src_doc_type = 'SALE_RETURN' AND r.sr_id = t.td_src_doc_id AND r.sr_acc_year = t.td_acc_year
  LEFT JOIN accounts.acc_voucher_header h
         ON t.td_voucher_id IS NOT NULL AND h.avh_voucher_id = t.td_voucher_id
  LEFT JOIN accounts.till_session s ON s.tss_id = t.td_session_id AND s.tss_acc_year = t.td_acc_year
  LEFT JOIN public.user_master u ON u.usr_id = t.td_user_id
 WHERE t.td_company_id = itd_company_id::uuid
   AND t.td_branch_id  = itd_branch_id::uuid
   AND (NULLIF(itender_id, '') IS NULL OR t.td_tender_id = NULLIF(itender_id, '')::uuid)
   AND t.td_is_deleted = false AND t.td_is_voided = false
   AND CASE COALESCE(NULLIF(iline_kind, ''), 'SALE')
         WHEN 'SALE'       THEN t.td_dr_cr = 'DR' AND t.td_settle_status IN ('PENDING','PARTIAL')
         WHEN 'REFUND'     THEN t.td_dr_cr = 'CR' AND t.td_settle_status IN ('PENDING','PARTIAL')
         WHEN 'CHARGEBACK' THEN t.td_dr_cr = 'DR' AND t.td_settle_status IN ('SETTLED','PARTIAL')
         ELSE false
       END
   AND (NULLIF(ifrom_date, '') IS NULL OR t.td_doc_date >= NULLIF(ifrom_date, '')::date)
   AND (NULLIF(ito_date,   '') IS NULL OR t.td_doc_date <= NULLIF(ito_date,   '')::date)
   AND CASE t.td_src_doc_type
         WHEN 'SALE_BILL'   THEN b.sb_status = 'POSTED'
         WHEN 'SALE_RETURN' THEN r.sr_status = 'POSTED'
         ELSE h.avh_voucher_status = 'POSTED' AND h.avh_is_deleted = false
       END
   AND NOT EXISTS (
         SELECT 1
           FROM accounts.acc_settlement_line l
           JOIN accounts.acc_settlement_import i
             ON i.asi_id = l.asl_import_id AND i.asi_acc_year = l.asl_acc_year
          WHERE l.asl_td_id = t.td_id AND l.asl_td_acc_year = t.td_acc_year
            AND l.asl_kind = COALESCE(NULLIF(iline_kind, ''), 'SALE')
            AND i.asi_is_deleted = false AND i.asi_status <> 'VOIDED'
            AND (l.asl_match_status IN ('MATCHED','SUGGESTED')
                 OR (l.asl_match_status = 'RESOLVED' AND l.asl_resolution = 'LINKED')))
 ORDER BY t.td_doc_date DESC, t.td_created_on DESC$g$,
       true, false, 'system'
 WHERE NOT EXISTS (SELECT 1 FROM fixed.grid_details d WHERE d.grid_name = 'TENDER SETTLEMENT - PICK ROW');

INSERT INTO fixed.grid_columns
       (grid_id, grid_column_number, grid_column_name, grid_column_width,
        grid_column_alignment, grid_column_visibility, grid_column_filter,
        grid_column_group, grid_column_total, grid_column_data_type,
        grid_column_is_deleted, grid_column_position, grid_column_sql_field_name,
        grid_column_created_by)
SELECT d.grid_id, v.col_no, v.col_name, v.width, v.align, v.visible, v.filterable,
       false, v.total, v.data_type, false, v.col_no, v.field, 'system'
  FROM fixed.grid_details d
  JOIN (VALUES
    ( 1, '#',             8.00, 'Left',   false, false, false, 'Text',     'td_id'),
    ( 2, 'Year',          5.00, 'Center', false, false, false, 'Text',     'td_acc_year'),
    ( 3, 'Tender',        9.00, 'Left',   true,  true,  false, 'Text',     'tender_name'),
    ( 4, 'Date',          8.00, 'Center', true,  true,  false, 'Date',     'td_doc_date'),
    ( 5, 'Keyed On',     11.00, 'Center', true,  false, false, 'DateTime', 'td_created_on'),
    ( 6, 'Doc Type',      8.00, 'Left',   false, true,  false, 'Text',     'td_src_doc_type'),
    ( 7, 'Bill / Doc',   10.00, 'Left',   true,  true,  false, 'Text',     'doc_refno'),
    ( 8, 'Session',       9.00, 'Left',   true,  true,  false, 'Text',     'session_no'),
    ( 9, 'Cashier',       8.00, 'Left',   false, true,  false, 'Text',     'cashier'),
    (10, 'Dr / Cr',       4.00, 'Center', false, false, false, 'Text',     'td_dr_cr'),
    (11, 'Amount',       10.00, 'Right',  true,  false, false, 'Currency', 'td_total_amt'),
    (12, 'Settled',       9.00, 'Right',  false, false, false, 'Currency', 'td_settle_amount'),
    (13, 'Outstanding',  10.00, 'Right',  true,  false, false, 'Currency', 'outstanding'),
    (14, 'RRN / UTR',    12.00, 'Left',   true,  true,  false, 'Text',     'td_ref_no'),
    (15, 'Auth',          7.00, 'Left',   true,  true,  false, 'Text',     'td_auth_code'),
    (16, 'Last 4',        5.00, 'Center', true,  true,  false, 'Text',     'td_card_last4'),
    (17, 'Payer VPA',    10.00, 'Left',   false, true,  false, 'Text',     'td_payer_vpa'),
    (18, 'Status',        7.00, 'Center', true,  true,  false, 'Text',     'td_settle_status'),
    (19, 'Expected On',   8.00, 'Center', false, false, false, 'Date',     'td_expected_settle_on')
  ) AS v(col_no, col_name, width, align, visible, filterable, total, data_type, field)
    ON d.grid_name = 'TENDER SETTLEMENT - PICK ROW'
 WHERE NOT EXISTS (SELECT 1 FROM fixed.grid_columns c WHERE c.grid_id = d.grid_id);


-- ── §5 · INCOME LEDGERS ────────────────────────────────────────────────────

INSERT INTO fixed.dropdown_details
       (dropdown_id, dropdown_name, dropdown_description, dropdown_sql,
        dropdown_sort_order, dropdown_sort_column, dropdown_completion,
        dropdown_max_visible_items, dropdown_show_header, dropdown_width,
        dropdown_device_type, dropdown_created_by)
SELECT CASE WHEN EXISTS (SELECT 1 FROM fixed.dropdown_details x WHERE x.dropdown_id = 69)
            THEN (SELECT max(x.dropdown_id) + 1 FROM fixed.dropdown_details x)
            ELSE 69 END,
       'INCOME LEDGERS',
       'Income ledgers (notes 99 §5): live ledgers under an Income group at any level - the rule /tender-settlement/resolve INCOME applies to incomeLedgerId. Shared (NULL company) plus this company. Param icompany_id, always sent.',
$d$SELECT l.led_id,
       l.led_name,
       g.acc_group_name AS group_name,
       l.led_short
  FROM accounts.acc_ledger_master l
  JOIN accounts.acc_group_master g ON g.acc_group_id = l.led_group_id
 WHERE (l.led_company_id IS NULL OR l.led_company_id::text = 'icompany_id')
   AND l.led_is_deleted = false
   AND l.led_is_active = true
   AND EXISTS (WITH RECURSIVE up(id, parent_id, d) AS (
                    SELECT x.acc_group_id, x.acc_group_parent_id, 0
                      FROM accounts.acc_group_master x WHERE x.acc_group_id = l.led_group_id
                    UNION ALL
                    SELECT p.acc_group_id, p.acc_group_parent_id, up.d + 1
                      FROM up JOIN accounts.acc_group_master p ON p.acc_group_id = up.parent_id
                     WHERE up.d < 24)
                SELECT 1
                  FROM up JOIN accounts.acc_group_master r ON r.acc_group_id = up.id
                 WHERE r.acc_group_nature = 'Income')
 ORDER BY l.led_name$d$,
       'Ascending', 'led_name', 'led_name',
       12, true, 0,
       'Desktop', 'system'
 WHERE NOT EXISTS (SELECT 1 FROM fixed.dropdown_details WHERE dropdown_name = 'INCOME LEDGERS');

INSERT INTO fixed.dropdown_columns
       (dropdown_columns_dropdown_id, dropdown_columns_no, dropdown_columns_data_type,
        dropdown_columns_name, dropdown_columns_alias, dropdown_columns_width,
        dropdown_columns_visiblity, dropdown_columns_allignment, dropdown_columns_filter,
        dropdown_columns_sql_name, dropdown_columns_created_by)
SELECT d.dropdown_id, v.no, 'text', v.name, v.name, v.width, v.visible, 'Left', v.filter, v.field, 'system'
  FROM fixed.dropdown_details d
  JOIN (VALUES
    (0, '#',      10.00, false, false, 'led_id'),
    (1, 'Ledger', 50.00, true,  true,  'led_name'),
    (2, 'Group',  30.00, true,  true,  'group_name'),
    (3, 'Short',  10.00, true,  true,  'led_short')
  ) AS v(no, name, width, visible, filter, field)
    ON d.dropdown_name = 'INCOME LEDGERS'
 WHERE NOT EXISTS (SELECT 1 FROM fixed.dropdown_columns c
                    WHERE c.dropdown_columns_dropdown_id = d.dropdown_id);

SELECT setval(pg_get_serial_sequence('fixed.dropdown_details', 'dropdown_id'),
              GREATEST((SELECT max(dropdown_id) FROM fixed.dropdown_details),
                       (SELECT last_value FROM fixed.dropdown_details_dropdown_id_seq)))
 WHERE pg_get_serial_sequence('fixed.dropdown_details', 'dropdown_id') IS NOT NULL;


-- ── §2 · td_mdr_amt of the sales rows a TSet already settled ────────────────
--  From now on the TSet writes it (MDR_FROM_STATEMENT_DOC_TYPES); a payout
--  posted before this — tst00013 on the dev box — gets it here: the fee + tax
--  of the MATCHED SALE line, on a row still settled by that payout's voucher.

UPDATE accounts.acc_tender_detail t
   SET td_mdr_amt = l.asl_fee_amount + l.asl_tax_amount,
       td_modified_on = now(), td_modified_by = 'migration 20261009170000'
  FROM accounts.acc_settlement_line l
  JOIN accounts.acc_settlement_import i
    ON i.asi_id = l.asl_import_id AND i.asi_acc_year = l.asl_acc_year
 WHERE l.asl_td_id = t.td_id AND l.asl_td_acc_year = t.td_acc_year
   AND l.asl_kind = 'SALE' AND l.asl_match_status = 'MATCHED'
   AND i.asi_status = 'POSTED' AND i.asi_is_deleted = false
   AND t.td_settle_voucher_id = i.asi_voucher_id
   AND t.td_src_doc_type IN ('SALE_BILL', 'SALE_RETURN', 'SALES_ORDER')
   AND t.td_mdr_amt = 0
   AND l.asl_fee_amount + l.asl_tax_amount > 0;


-- ── Read-back ──────────────────────────────────────────────────────────────
-- SELECT grid_id, grid_name FROM fixed.grid_details WHERE grid_name LIKE 'TENDER SETTLEMENT%' ORDER BY 1;
-- SELECT dropdown_id, dropdown_name FROM fixed.dropdown_details WHERE dropdown_name = 'INCOME LEDGERS';
