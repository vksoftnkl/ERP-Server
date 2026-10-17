-- ═══════════════════════════════════════════════════════════════════════════
--  Tender settlement — its menu and its six lists                 2026-10-08
--
--  till/plan-noncash-tender-control.md §5–§8: the schema is 49's
--  (20261008130000_noncash_tender_control); the routes are
--  /api/v1/tender-settlement/* (src/modules/accountsModule/tenderSettlement).
--  This gives them what a screen needs:
--
--    1 · menu 278 'Settlement Reconciliation' under Accounts (5), HIDDEN until
--        the client screen ships. Every route is judged on its user_menus row:
--          VIEW get · format · format/test     CREATE import
--          EDIT match · confirm · unlink · ignore · format
--          POST post                            CANCEL void
--          OVERRIDE write-off · resolve — it stands in for the NONCASH_WRITE_OFF
--                   and SETTLEMENT_RESOLVE approvals until the approval gate
--                   (till phase 3) ships (user's call, 2026-10-08)
--    2 · the six grids of §7 ("lists are grids, not routes"):
--          MAIN LIST - TENDER SETTLEMENTS       the payouts
--          TENDER SETTLEMENT - LINES            one payout's lines and what each matched
--          TENDER SETTLEMENT - NOT RECEIVED     §6.1 our row, no money
--          TENDER SETTLEMENT - UNEXPLAINED      §6.2 money, no row
--          TENDER SETTLEMENT - DUPLICATE REFS   §3.2 the same reference twice
--          TENDER SETTLEMENT - SUSPENSE         §6.3 Tender suspense, leg by leg
--        Ids 138–143 where free (the client finds a grid by NAME); otherwise the
--        sequence picks. Tokens are bare names bound as parameters; send every
--        one, '' = no bound.
--
--  The menu id is PINNED and the same row is in prisma/seed/Menu_Master.sql;
--  an id already taken by a DIFFERENT menu stops the migration.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT format('%s (%s)', m.menu_id, m.menu_name)
      INTO v_clash
      FROM fixed.menu_master m
     WHERE m.menu_id = 278 AND m.menu_name <> 'Settlement Reconciliation';
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Settlement menu: id already taken by another menu: %. Pick a free id here and in Menu_Master.sql.', v_clash;
    END IF;
END $$;

INSERT INTO fixed.menu_master
       (menu_id, menu_parent, menu_name, menu_visiblity, menu_position, menu_is_active,
        menu_separator, menu_verbs, menu_created_on, menu_modified_on)
SELECT 278, 5, 'Settlement Reconciliation', false, 11.60, true, false,
       '{VIEW,CREATE,EDIT,PRINT,EXPORT,POST,CANCEL,OVERRIDE}'::text[], now(), now()
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 5)
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 278);

SELECT setval('fixed.menu_master_menu_id_seq',
              GREATEST((SELECT COALESCE(max(menu_id), 0) FROM fixed.menu_master),
                       (SELECT last_value FROM fixed.menu_master_menu_id_seq)));


-- ═══════════════════════════════════════════════════════════════════════════
--  2 · the grids
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TEMP TABLE _tset_grid (
    pin_id    bigint,
    name      text,
    descr     text,
    sort_col  text,
    sort_ord  text,
    sql_text  text
) ON COMMIT DROP;

INSERT INTO _tset_grid VALUES
(138, 'MAIN LIST - TENDER SETTLEMENTS',
 'Provider payouts imported for a company / branch / year (menu 278): totals, match counts, the TSet.',
 'Payout Date', 'Descending',
$g$SELECT i.asi_id,
       i.asi_acc_year,
       i.asi_company_id,
       i.asi_branch_id,
       i.asi_payout_date,
       i.asi_payout_ref,
       i.asi_provider,
       i.asi_source,
       m.tnd_name                                   AS tender_name,
       i.asi_file_name,
       i.asi_line_count,
       i.asi_total_gross,
       i.asi_total_fee,
       i.asi_total_tax,
       i.asi_total_net,
       (SELECT count(*) FROM accounts.acc_settlement_line l
         WHERE l.asl_import_id = i.asi_id AND l.asl_acc_year = i.asi_acc_year
           AND l.asl_kind IN ('SALE','REFUND','CHARGEBACK') AND l.asl_match_status = 'MATCHED')    AS matched_count,
       (SELECT count(*) FROM accounts.acc_settlement_line l
         WHERE l.asl_import_id = i.asi_id AND l.asl_acc_year = i.asi_acc_year
           AND l.asl_kind IN ('SALE','REFUND','CHARGEBACK') AND l.asl_match_status = 'SUGGESTED')  AS suggested_count,
       (SELECT count(*) FROM accounts.acc_settlement_line l
         WHERE l.asl_import_id = i.asi_id AND l.asl_acc_year = i.asi_acc_year
           AND l.asl_kind IN ('SALE','REFUND','CHARGEBACK') AND l.asl_match_status = 'UNMATCHED')  AS unmatched_count,
       i.asi_status,
       v.avh_voucher_refno                          AS voucher_refno,
       i.asi_imported_on,
       i.asi_void_reason,
       i.asi_notes
  FROM accounts.acc_settlement_import i
  LEFT JOIN accounts.acc_tender_master m ON m.tnd_id = i.asi_tender_id
  LEFT JOIN accounts.acc_voucher_header v
         ON v.avh_voucher_id = i.asi_voucher_id AND v.avh_acc_year = i.asi_voucher_acc_year
 WHERE i.asi_company_id = iasi_company_id::uuid
   AND i.asi_branch_id  = iasi_branch_id::uuid
   AND i.asi_acc_year   = iasi_acc_year::bpchar
   AND i.asi_is_deleted = false
   AND (NULLIF(iasi_status, '') IS NULL OR i.asi_status = iasi_status)
   AND (NULLIF(ifrom_date, '') IS NULL OR i.asi_payout_date >= NULLIF(ifrom_date, '')::date)
   AND (NULLIF(ito_date,   '') IS NULL OR i.asi_payout_date <= NULLIF(ito_date,   '')::date)
 ORDER BY i.asi_payout_date DESC, i.asi_imported_on DESC$g$),

(139, 'TENDER SETTLEMENT - LINES',
 'One payout''s provider lines (iasi_id, iasi_acc_year): kind, amounts, what each matched and how.',
 'Row', 'Ascending',
$g$SELECT l.asl_id,
       l.asl_acc_year,
       l.asl_row_no,
       l.asl_kind,
       l.asl_txn_on,
       l.asl_terminal_id,
       l.asl_vpa,
       m.tnd_name                                   AS tender_name,
       l.asl_ref_no,
       l.asl_auth_code,
       l.asl_card_last4,
       l.asl_payer,
       l.asl_gross_amount,
       l.asl_fee_amount,
       l.asl_tax_amount,
       l.asl_net_amount,
       l.asl_match_status,
       l.asl_match_rule,
       t.td_src_doc_type,
       COALESCE(b.sb_bill_refno, h.avh_voucher_refno) AS doc_refno,
       t.td_total_amt                               AS row_amount,
       l.asl_amount_diff,
       l.asl_resolution,
       l.asl_notes,
       l.asl_td_id,
       l.asl_td_acc_year
  FROM accounts.acc_settlement_line l
  LEFT JOIN accounts.acc_tender_master m ON m.tnd_id = l.asl_tender_id
  LEFT JOIN accounts.acc_tender_detail t ON t.td_id = l.asl_td_id AND t.td_acc_year = l.asl_td_acc_year
  LEFT JOIN sales.sale_bill b
         ON t.td_src_doc_type = 'SALE_BILL' AND b.sb_id = t.td_src_doc_id AND b.sb_acc_year = t.td_acc_year
  LEFT JOIN accounts.acc_voucher_header h
         ON h.avh_voucher_id = t.td_src_doc_id AND h.avh_acc_year = t.td_acc_year
 WHERE l.asl_import_id = iasi_id::uuid
   AND l.asl_acc_year  = iasi_acc_year::bpchar
 ORDER BY l.asl_row_no$g$),

(140, 'TENDER SETTLEMENT - NOT RECEIVED',
 'Non-cash plan §6.1: card / UPI / wallet rows of POSTED documents still PENDING (or PARTIAL) past the expected settlement + grace days (igrace_days, '''' = 2).',
 'Expected On', 'Ascending',
$g$SELECT t.td_id,
       t.td_acc_year,
       t.td_company_id,
       t.td_branch_id,
       m.tnd_name                                   AS tender_name,
       t.td_doc_date,
       t.td_expected_settle_on,
       (current_date - t.td_expected_settle_on)     AS days_overdue,
       t.td_src_doc_type,
       COALESCE(b.sb_bill_refno, h.avh_voucher_refno) AS doc_refno,
       s.tss_session_no                             AS session_no,
       u.usr_login_name                             AS cashier,
       t.td_total_amt,
       t.td_settle_amount,
       (t.td_total_amt - COALESCE(t.td_settle_amount, 0)) AS outstanding,
       t.td_ref_no,
       t.td_auth_code,
       t.td_card_last4,
       t.td_settle_status
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
   AND t.td_settle_status IN ('PENDING','PARTIAL')
   AND t.td_is_deleted = false AND t.td_is_voided = false
   AND t.td_dr_cr = 'DR'
   AND t.td_expected_settle_on + COALESCE(NULLIF(igrace_days, '')::int, 2) < current_date
   AND (NULLIF(itender_id, '') IS NULL OR t.td_tender_id = NULLIF(itender_id, '')::uuid)
   AND CASE t.td_src_doc_type
         WHEN 'SALE_BILL'   THEN b.sb_status = 'POSTED'
         WHEN 'SALE_RETURN' THEN r.sr_status = 'POSTED'
         ELSE h.avh_voucher_status = 'POSTED' AND h.avh_is_deleted = false
       END
 ORDER BY t.td_expected_settle_on, t.td_doc_date$g$),

(141, 'TENDER SETTLEMENT - UNEXPLAINED',
 'Non-cash plan §6.2: SALE lines of a provider statement that no tender row explains (money, no bill) — resolve them.',
 'Txn On', 'Ascending',
$g$SELECT l.asl_id,
       l.asl_acc_year,
       i.asi_id,
       i.asi_payout_date,
       i.asi_payout_ref,
       i.asi_provider,
       i.asi_status,
       m.tnd_name                                   AS tender_name,
       l.asl_row_no,
       l.asl_txn_on,
       l.asl_terminal_id,
       l.asl_vpa,
       l.asl_ref_no,
       l.asl_auth_code,
       l.asl_card_last4,
       l.asl_payer,
       l.asl_gross_amount,
       l.asl_net_amount,
       (current_date - i.asi_payout_date)           AS age_days
  FROM accounts.acc_settlement_line l
  JOIN accounts.acc_settlement_import i
    ON i.asi_id = l.asl_import_id AND i.asi_acc_year = l.asl_acc_year
  LEFT JOIN accounts.acc_tender_master m ON m.tnd_id = l.asl_tender_id
 WHERE i.asi_company_id = iasi_company_id::uuid
   AND i.asi_branch_id  = iasi_branch_id::uuid
   AND i.asi_is_deleted = false
   AND i.asi_status <> 'VOIDED'
   AND l.asl_match_status = 'UNMATCHED'
   AND l.asl_kind = 'SALE'
 ORDER BY l.asl_txn_on NULLS LAST, l.asl_row_no$g$),

(142, 'TENDER SETTLEMENT - DUPLICATE REFS',
 'Non-cash plan §3.2: live money-in rows sharing a UPI / wallet reference, or a card approval code + last 4 + amount, across the company (ifrom_date / ito_date on the document date).',
 'Reference', 'Ascending',
$g$WITH live AS (
  SELECT t.*, y.ttm_type_name
    FROM accounts.acc_tender_detail t
    JOIN accounts.acc_tender_types y ON y.ttm_type_id = t.td_tender_type_id
   WHERE t.td_company_id = itd_company_id::uuid
     AND t.td_is_deleted = false AND t.td_is_voided = false
     AND t.td_dr_cr = 'DR'
     AND (NULLIF(ifrom_date, '') IS NULL OR t.td_doc_date >= NULLIF(ifrom_date, '')::date)
     AND (NULLIF(ito_date,   '') IS NULL OR t.td_doc_date <= NULLIF(ito_date,   '')::date)
), keyed AS (
  SELECT live.*,
         CASE
           WHEN ttm_type_name IN ('UPI','WALLET') AND NULLIF(btrim(td_ref_no), '') IS NOT NULL
             THEN 'REF ' || upper(btrim(td_ref_no))
           WHEN ttm_type_name = 'CARD' AND NULLIF(btrim(td_auth_code), '') IS NOT NULL
             THEN 'AUTH ' || upper(btrim(td_auth_code)) || ' …' || COALESCE(td_card_last4, '????') || ' ' || td_total_amt::text
         END AS dup_key
    FROM live
)
SELECT k.td_id,
       k.td_acc_year,
       k.td_branch_id,
       k.dup_key,
       count(*) OVER (PARTITION BY k.td_tender_id, k.dup_key) AS dup_count,
       m.tnd_name                                   AS tender_name,
       k.td_doc_date,
       k.td_src_doc_type,
       COALESCE(b.sb_bill_refno, h.avh_voucher_refno) AS doc_refno,
       k.td_total_amt,
       k.td_ref_no,
       k.td_auth_code,
       k.td_card_last4,
       s.tss_session_no                             AS session_no,
       k.td_created_on
  FROM keyed k
  JOIN accounts.acc_tender_master m ON m.tnd_id = k.td_tender_id
  LEFT JOIN sales.sale_bill b
         ON k.td_src_doc_type = 'SALE_BILL' AND b.sb_id = k.td_src_doc_id AND b.sb_acc_year = k.td_acc_year
  LEFT JOIN accounts.acc_voucher_header h
         ON h.avh_voucher_id = k.td_src_doc_id AND h.avh_acc_year = k.td_acc_year
  LEFT JOIN accounts.till_session s ON s.tss_id = k.td_session_id AND s.tss_acc_year = k.td_acc_year
 WHERE k.dup_key IS NOT NULL
   AND (k.td_tender_id, k.dup_key) IN (
         SELECT td_tender_id, dup_key FROM keyed
          WHERE dup_key IS NOT NULL
          GROUP BY td_tender_id, dup_key HAVING count(*) > 1)
 ORDER BY k.dup_key, k.td_created_on$g$),

(143, 'TENDER SETTLEMENT - SUSPENSE',
 'Non-cash plan §6.3: every leg on the Tender suspense ledger (role TENDER_SUSPENSE) of a company / branch, with the document that put it there — the balance must reach zero.',
 'Date', 'Ascending',
$g$SELECT v.av_voucher_id,
       v.av_acc_year,
       h.avh_voucher_date,
       h.avh_voucher_refno,
       vt.vchr_type_code,
       h.avh_src_doc_type,
       h.avh_src_doc_id,
       CASE WHEN v.av_dr_cr = 'DR' THEN v.av_amount END AS debit,
       CASE WHEN v.av_dr_cr = 'CR' THEN v.av_amount END AS credit,
       h.avh_voucher_status,
       s.tss_session_no                             AS session_no,
       h.avh_remarks
  FROM accounts.acc_vouchers v
  JOIN accounts.acc_voucher_header h
    ON h.avh_voucher_id = v.av_voucher_id AND h.avh_acc_year = v.av_acc_year
  JOIN accounts.acc_voucher_types vt ON vt.vchr_type_id = h.avh_voucher_type_id
  LEFT JOIN accounts.till_session s ON s.tss_id = h.avh_session_id AND s.tss_acc_year = h.avh_acc_year
 WHERE h.avh_company_id = iavh_company_id::uuid
   AND h.avh_branch_id  = iavh_branch_id::uuid
   AND h.avh_is_deleted = false
   AND h.avh_voucher_status IN ('POSTED','CANCELLED')
   AND v.av_is_deleted = false
   AND v.av_ledger_id IN (
         SELECT x.alm_ledger_id FROM accounts.acc_ledger_map x
          WHERE x.alm_role = 'TENDER_SUSPENSE' AND x.alm_is_deleted = false AND x.alm_is_active
            AND (x.alm_company_id IS NULL OR x.alm_company_id = iavh_company_id::uuid))
   AND (NULLIF(ifrom_date, '') IS NULL OR h.avh_voucher_date >= NULLIF(ifrom_date, '')::date)
   AND (NULLIF(ito_date,   '') IS NULL OR h.avh_voucher_date <= NULLIF(ito_date,   '')::date)
 ORDER BY h.avh_voucher_date, h.avh_voucher_slno NULLS LAST, v.av_row_no$g$);

INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_device_type,
        grid_sort_column, grid_sort_order, grid_sql, grid_status,
        grid_is_deleted, grid_created_by)
SELECT CASE WHEN EXISTS (SELECT 1 FROM fixed.grid_details d WHERE d.grid_id = g.pin_id)
            THEN nextval(pg_get_serial_sequence('fixed.grid_details', 'grid_id'))
            ELSE g.pin_id END,
       g.name, g.descr, 'Desktop', g.sort_col, g.sort_ord, g.sql_text, true, false, 'system'
  FROM _tset_grid g
 WHERE NOT EXISTS (SELECT 1 FROM fixed.grid_details d WHERE d.grid_name = g.name)
 ORDER BY g.pin_id;

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
    -- MAIN LIST - TENDER SETTLEMENTS
    ('MAIN LIST - TENDER SETTLEMENTS',  1, '#',             8.00, 'Left',   false, false, false, 'Text',     'asi_id'),
    ('MAIN LIST - TENDER SETTLEMENTS',  2, 'Year',          5.00, 'Center', false, false, false, 'Text',     'asi_acc_year'),
    ('MAIN LIST - TENDER SETTLEMENTS',  3, 'Company',       8.00, 'Left',   false, false, false, 'Text',     'asi_company_id'),
    ('MAIN LIST - TENDER SETTLEMENTS',  4, 'Branch',        8.00, 'Left',   false, false, false, 'Text',     'asi_branch_id'),
    ('MAIN LIST - TENDER SETTLEMENTS',  5, 'Payout Date',   9.00, 'Center', true,  true,  false, 'Date',     'asi_payout_date'),
    ('MAIN LIST - TENDER SETTLEMENTS',  6, 'Payout UTR',   12.00, 'Left',   true,  true,  false, 'Text',     'asi_payout_ref'),
    ('MAIN LIST - TENDER SETTLEMENTS',  7, 'Provider',     10.00, 'Left',   true,  true,  false, 'Text',     'asi_provider'),
    ('MAIN LIST - TENDER SETTLEMENTS',  8, 'Source',        6.00, 'Center', true,  true,  false, 'Text',     'asi_source'),
    ('MAIN LIST - TENDER SETTLEMENTS',  9, 'Tender',       10.00, 'Left',   true,  true,  false, 'Text',     'tender_name'),
    ('MAIN LIST - TENDER SETTLEMENTS', 10, 'File',         14.00, 'Left',   false, true,  false, 'Text',     'asi_file_name'),
    ('MAIN LIST - TENDER SETTLEMENTS', 11, 'Lines',         5.00, 'Right',  true,  false, false, 'Number',   'asi_line_count'),
    ('MAIN LIST - TENDER SETTLEMENTS', 12, 'Gross',        11.00, 'Right',  true,  false, true,  'Currency', 'asi_total_gross'),
    ('MAIN LIST - TENDER SETTLEMENTS', 13, 'Fee',           9.00, 'Right',  true,  false, true,  'Currency', 'asi_total_fee'),
    ('MAIN LIST - TENDER SETTLEMENTS', 14, 'GST on Fee',    9.00, 'Right',  true,  false, true,  'Currency', 'asi_total_tax'),
    ('MAIN LIST - TENDER SETTLEMENTS', 15, 'Net',          11.00, 'Right',  true,  false, true,  'Currency', 'asi_total_net'),
    ('MAIN LIST - TENDER SETTLEMENTS', 16, 'Matched',       6.00, 'Right',  true,  false, false, 'Number',   'matched_count'),
    ('MAIN LIST - TENDER SETTLEMENTS', 17, 'Suggested',     6.00, 'Right',  true,  false, false, 'Number',   'suggested_count'),
    ('MAIN LIST - TENDER SETTLEMENTS', 18, 'Unmatched',     6.00, 'Right',  true,  false, false, 'Number',   'unmatched_count'),
    ('MAIN LIST - TENDER SETTLEMENTS', 19, 'Status',        8.00, 'Center', true,  true,  false, 'Text',     'asi_status'),
    ('MAIN LIST - TENDER SETTLEMENTS', 20, 'Voucher',      10.00, 'Left',   true,  true,  false, 'Text',     'voucher_refno'),
    ('MAIN LIST - TENDER SETTLEMENTS', 21, 'Imported On',  10.00, 'Center', false, false, false, 'Date',     'asi_imported_on'),
    ('MAIN LIST - TENDER SETTLEMENTS', 22, 'Void Reason',  14.00, 'Left',   false, false, false, 'Text',     'asi_void_reason'),
    ('MAIN LIST - TENDER SETTLEMENTS', 23, 'Notes',        14.00, 'Left',   false, false, false, 'Text',     'asi_notes'),
    -- TENDER SETTLEMENT - LINES
    ('TENDER SETTLEMENT - LINES',  1, '#',             8.00, 'Left',   false, false, false, 'Text',     'asl_id'),
    ('TENDER SETTLEMENT - LINES',  2, 'Year',          5.00, 'Center', false, false, false, 'Text',     'asl_acc_year'),
    ('TENDER SETTLEMENT - LINES',  3, 'Row',           4.00, 'Right',  true,  false, false, 'Number',   'asl_row_no'),
    ('TENDER SETTLEMENT - LINES',  4, 'Kind',          7.00, 'Center', true,  true,  false, 'Text',     'asl_kind'),
    ('TENDER SETTLEMENT - LINES',  5, 'Txn On',       11.00, 'Center', true,  false, false, 'DateTime', 'asl_txn_on'),
    ('TENDER SETTLEMENT - LINES',  6, 'TID',           7.00, 'Left',   true,  true,  false, 'Text',     'asl_terminal_id'),
    ('TENDER SETTLEMENT - LINES',  7, 'VPA',          10.00, 'Left',   false, true,  false, 'Text',     'asl_vpa'),
    ('TENDER SETTLEMENT - LINES',  8, 'Tender',        9.00, 'Left',   true,  true,  false, 'Text',     'tender_name'),
    ('TENDER SETTLEMENT - LINES',  9, 'RRN / UTR',    12.00, 'Left',   true,  true,  false, 'Text',     'asl_ref_no'),
    ('TENDER SETTLEMENT - LINES', 10, 'Auth',          7.00, 'Left',   true,  true,  false, 'Text',     'asl_auth_code'),
    ('TENDER SETTLEMENT - LINES', 11, 'Last 4',        5.00, 'Center', true,  true,  false, 'Text',     'asl_card_last4'),
    ('TENDER SETTLEMENT - LINES', 12, 'Payer',        10.00, 'Left',   false, true,  false, 'Text',     'asl_payer'),
    ('TENDER SETTLEMENT - LINES', 13, 'Gross',        10.00, 'Right',  true,  false, true,  'Currency', 'asl_gross_amount'),
    ('TENDER SETTLEMENT - LINES', 14, 'Fee',           8.00, 'Right',  true,  false, true,  'Currency', 'asl_fee_amount'),
    ('TENDER SETTLEMENT - LINES', 15, 'GST',           7.00, 'Right',  true,  false, true,  'Currency', 'asl_tax_amount'),
    ('TENDER SETTLEMENT - LINES', 16, 'Net',          10.00, 'Right',  true,  false, true,  'Currency', 'asl_net_amount'),
    ('TENDER SETTLEMENT - LINES', 17, 'Match',         8.00, 'Center', true,  true,  false, 'Text',     'asl_match_status'),
    ('TENDER SETTLEMENT - LINES', 18, 'Rule',          7.00, 'Center', true,  true,  false, 'Text',     'asl_match_rule'),
    ('TENDER SETTLEMENT - LINES', 19, 'Doc Type',      8.00, 'Left',   false, true,  false, 'Text',     'td_src_doc_type'),
    ('TENDER SETTLEMENT - LINES', 20, 'Bill / Doc',   10.00, 'Left',   true,  true,  false, 'Text',     'doc_refno'),
    ('TENDER SETTLEMENT - LINES', 21, 'Row Amount',   10.00, 'Right',  true,  false, false, 'Currency', 'row_amount'),
    ('TENDER SETTLEMENT - LINES', 22, 'Difference',    8.00, 'Right',  true,  false, true,  'Currency', 'asl_amount_diff'),
    ('TENDER SETTLEMENT - LINES', 23, 'Resolution',    8.00, 'Center', true,  true,  false, 'Text',     'asl_resolution'),
    ('TENDER SETTLEMENT - LINES', 24, 'Notes',        14.00, 'Left',   false, false, false, 'Text',     'asl_notes'),
    ('TENDER SETTLEMENT - LINES', 25, 'Tender Row',    8.00, 'Left',   false, false, false, 'Text',     'asl_td_id'),
    ('TENDER SETTLEMENT - LINES', 26, 'Row Year',      5.00, 'Center', false, false, false, 'Text',     'asl_td_acc_year'),
    -- TENDER SETTLEMENT - NOT RECEIVED
    ('TENDER SETTLEMENT - NOT RECEIVED',  1, '#',             8.00, 'Left',   false, false, false, 'Text',     'td_id'),
    ('TENDER SETTLEMENT - NOT RECEIVED',  2, 'Year',          5.00, 'Center', false, false, false, 'Text',     'td_acc_year'),
    ('TENDER SETTLEMENT - NOT RECEIVED',  3, 'Company',       8.00, 'Left',   false, false, false, 'Text',     'td_company_id'),
    ('TENDER SETTLEMENT - NOT RECEIVED',  4, 'Branch',        8.00, 'Left',   false, false, false, 'Text',     'td_branch_id'),
    ('TENDER SETTLEMENT - NOT RECEIVED',  5, 'Tender',        9.00, 'Left',   true,  true,  false, 'Text',     'tender_name'),
    ('TENDER SETTLEMENT - NOT RECEIVED',  6, 'Date',          9.00, 'Center', true,  true,  false, 'Date',     'td_doc_date'),
    ('TENDER SETTLEMENT - NOT RECEIVED',  7, 'Expected On',   9.00, 'Center', true,  false, false, 'Date',     'td_expected_settle_on'),
    ('TENDER SETTLEMENT - NOT RECEIVED',  8, 'Days Over',     6.00, 'Right',  true,  false, false, 'Number',   'days_overdue'),
    ('TENDER SETTLEMENT - NOT RECEIVED',  9, 'Doc Type',      8.00, 'Left',   false, true,  false, 'Text',     'td_src_doc_type'),
    ('TENDER SETTLEMENT - NOT RECEIVED', 10, 'Bill / Doc',   10.00, 'Left',   true,  true,  false, 'Text',     'doc_refno'),
    ('TENDER SETTLEMENT - NOT RECEIVED', 11, 'Session',       9.00, 'Left',   true,  true,  false, 'Text',     'session_no'),
    ('TENDER SETTLEMENT - NOT RECEIVED', 12, 'Cashier',       9.00, 'Left',   true,  true,  false, 'Text',     'cashier'),
    ('TENDER SETTLEMENT - NOT RECEIVED', 13, 'Amount',       10.00, 'Right',  true,  false, true,  'Currency', 'td_total_amt'),
    ('TENDER SETTLEMENT - NOT RECEIVED', 14, 'Paid So Far',  10.00, 'Right',  false, false, true,  'Currency', 'td_settle_amount'),
    ('TENDER SETTLEMENT - NOT RECEIVED', 15, 'Outstanding',  10.00, 'Right',  true,  false, true,  'Currency', 'outstanding'),
    ('TENDER SETTLEMENT - NOT RECEIVED', 16, 'Reference',    12.00, 'Left',   true,  true,  false, 'Text',     'td_ref_no'),
    ('TENDER SETTLEMENT - NOT RECEIVED', 17, 'Auth',          7.00, 'Left',   false, true,  false, 'Text',     'td_auth_code'),
    ('TENDER SETTLEMENT - NOT RECEIVED', 18, 'Last 4',        5.00, 'Center', true,  true,  false, 'Text',     'td_card_last4'),
    ('TENDER SETTLEMENT - NOT RECEIVED', 19, 'Status',        7.00, 'Center', true,  true,  false, 'Text',     'td_settle_status'),
    -- TENDER SETTLEMENT - UNEXPLAINED
    ('TENDER SETTLEMENT - UNEXPLAINED',  1, '#',             8.00, 'Left',   false, false, false, 'Text',     'asl_id'),
    ('TENDER SETTLEMENT - UNEXPLAINED',  2, 'Year',          5.00, 'Center', false, false, false, 'Text',     'asl_acc_year'),
    ('TENDER SETTLEMENT - UNEXPLAINED',  3, 'Import',        8.00, 'Left',   false, false, false, 'Text',     'asi_id'),
    ('TENDER SETTLEMENT - UNEXPLAINED',  4, 'Payout Date',   9.00, 'Center', true,  true,  false, 'Date',     'asi_payout_date'),
    ('TENDER SETTLEMENT - UNEXPLAINED',  5, 'Payout UTR',   12.00, 'Left',   true,  true,  false, 'Text',     'asi_payout_ref'),
    ('TENDER SETTLEMENT - UNEXPLAINED',  6, 'Provider',      9.00, 'Left',   true,  true,  false, 'Text',     'asi_provider'),
    ('TENDER SETTLEMENT - UNEXPLAINED',  7, 'Payout Status', 8.00, 'Center', true,  true,  false, 'Text',     'asi_status'),
    ('TENDER SETTLEMENT - UNEXPLAINED',  8, 'Tender',        9.00, 'Left',   true,  true,  false, 'Text',     'tender_name'),
    ('TENDER SETTLEMENT - UNEXPLAINED',  9, 'Row',           4.00, 'Right',  false, false, false, 'Number',   'asl_row_no'),
    ('TENDER SETTLEMENT - UNEXPLAINED', 10, 'Txn On',       11.00, 'Center', true,  false, false, 'DateTime', 'asl_txn_on'),
    ('TENDER SETTLEMENT - UNEXPLAINED', 11, 'TID',           7.00, 'Left',   true,  true,  false, 'Text',     'asl_terminal_id'),
    ('TENDER SETTLEMENT - UNEXPLAINED', 12, 'VPA',          10.00, 'Left',   false, true,  false, 'Text',     'asl_vpa'),
    ('TENDER SETTLEMENT - UNEXPLAINED', 13, 'RRN / UTR',    12.00, 'Left',   true,  true,  false, 'Text',     'asl_ref_no'),
    ('TENDER SETTLEMENT - UNEXPLAINED', 14, 'Auth',          7.00, 'Left',   false, true,  false, 'Text',     'asl_auth_code'),
    ('TENDER SETTLEMENT - UNEXPLAINED', 15, 'Last 4',        5.00, 'Center', true,  true,  false, 'Text',     'asl_card_last4'),
    ('TENDER SETTLEMENT - UNEXPLAINED', 16, 'Payer',        10.00, 'Left',   true,  true,  false, 'Text',     'asl_payer'),
    ('TENDER SETTLEMENT - UNEXPLAINED', 17, 'Gross',        10.00, 'Right',  true,  false, true,  'Currency', 'asl_gross_amount'),
    ('TENDER SETTLEMENT - UNEXPLAINED', 18, 'Net',          10.00, 'Right',  false, false, true,  'Currency', 'asl_net_amount'),
    ('TENDER SETTLEMENT - UNEXPLAINED', 19, 'Age (days)',    6.00, 'Right',  true,  false, false, 'Number',   'age_days'),
    -- TENDER SETTLEMENT - DUPLICATE REFS
    ('TENDER SETTLEMENT - DUPLICATE REFS',  1, '#',            8.00, 'Left',   false, false, false, 'Text',     'td_id'),
    ('TENDER SETTLEMENT - DUPLICATE REFS',  2, 'Year',         5.00, 'Center', false, false, false, 'Text',     'td_acc_year'),
    ('TENDER SETTLEMENT - DUPLICATE REFS',  3, 'Branch',       8.00, 'Left',   false, false, false, 'Text',     'td_branch_id'),
    ('TENDER SETTLEMENT - DUPLICATE REFS',  4, 'Reference',   18.00, 'Left',   true,  true,  false, 'Text',     'dup_key'),
    ('TENDER SETTLEMENT - DUPLICATE REFS',  5, 'Times',        5.00, 'Right',  true,  false, false, 'Number',   'dup_count'),
    ('TENDER SETTLEMENT - DUPLICATE REFS',  6, 'Tender',       9.00, 'Left',   true,  true,  false, 'Text',     'tender_name'),
    ('TENDER SETTLEMENT - DUPLICATE REFS',  7, 'Date',         9.00, 'Center', true,  true,  false, 'Date',     'td_doc_date'),
    ('TENDER SETTLEMENT - DUPLICATE REFS',  8, 'Doc Type',     8.00, 'Left',   false, true,  false, 'Text',     'td_src_doc_type'),
    ('TENDER SETTLEMENT - DUPLICATE REFS',  9, 'Bill / Doc',  10.00, 'Left',   true,  true,  false, 'Text',     'doc_refno'),
    ('TENDER SETTLEMENT - DUPLICATE REFS', 10, 'Amount',      10.00, 'Right',  true,  false, false, 'Currency', 'td_total_amt'),
    ('TENDER SETTLEMENT - DUPLICATE REFS', 11, 'Ref No',      12.00, 'Left',   false, true,  false, 'Text',     'td_ref_no'),
    ('TENDER SETTLEMENT - DUPLICATE REFS', 12, 'Auth',         7.00, 'Left',   false, true,  false, 'Text',     'td_auth_code'),
    ('TENDER SETTLEMENT - DUPLICATE REFS', 13, 'Last 4',       5.00, 'Center', false, true,  false, 'Text',     'td_card_last4'),
    ('TENDER SETTLEMENT - DUPLICATE REFS', 14, 'Session',      9.00, 'Left',   true,  true,  false, 'Text',     'session_no'),
    ('TENDER SETTLEMENT - DUPLICATE REFS', 15, 'Keyed On',    11.00, 'Center', true,  false, false, 'DateTime', 'td_created_on'),
    -- TENDER SETTLEMENT - SUSPENSE
    ('TENDER SETTLEMENT - SUSPENSE',  1, '#',             8.00, 'Left',   false, false, false, 'Text',     'av_voucher_id'),
    ('TENDER SETTLEMENT - SUSPENSE',  2, 'Year',          5.00, 'Center', false, false, false, 'Text',     'av_acc_year'),
    ('TENDER SETTLEMENT - SUSPENSE',  3, 'Date',          9.00, 'Center', true,  true,  false, 'Date',     'avh_voucher_date'),
    ('TENDER SETTLEMENT - SUSPENSE',  4, 'Voucher',      10.00, 'Left',   true,  true,  false, 'Text',     'avh_voucher_refno'),
    ('TENDER SETTLEMENT - SUSPENSE',  5, 'Type',          6.00, 'Center', true,  true,  false, 'Text',     'vchr_type_code'),
    ('TENDER SETTLEMENT - SUSPENSE',  6, 'Source',       12.00, 'Left',   true,  true,  false, 'Text',     'avh_src_doc_type'),
    ('TENDER SETTLEMENT - SUSPENSE',  7, 'Source Id',     8.00, 'Left',   false, false, false, 'Text',     'avh_src_doc_id'),
    ('TENDER SETTLEMENT - SUSPENSE',  8, 'Debit',        10.00, 'Right',  true,  false, true,  'Currency', 'debit'),
    ('TENDER SETTLEMENT - SUSPENSE',  9, 'Credit',       10.00, 'Right',  true,  false, true,  'Currency', 'credit'),
    ('TENDER SETTLEMENT - SUSPENSE', 10, 'Status',        8.00, 'Center', true,  true,  false, 'Text',     'avh_voucher_status'),
    ('TENDER SETTLEMENT - SUSPENSE', 11, 'Session',       9.00, 'Left',   true,  true,  false, 'Text',     'session_no'),
    ('TENDER SETTLEMENT - SUSPENSE', 12, 'Remarks',      18.00, 'Left',   true,  false, false, 'Text',     'avh_remarks')
  ) AS v(grid_name, col_no, col_name, width, align, visible, filterable, total, data_type, field)
    ON v.grid_name = d.grid_name
 WHERE NOT EXISTS (SELECT 1 FROM fixed.grid_columns c WHERE c.grid_id = d.grid_id);

SELECT setval(pg_get_serial_sequence('fixed.grid_details', 'grid_id'),
              GREATEST((SELECT max(grid_id) FROM fixed.grid_details),
                       (SELECT last_value FROM fixed.grid_details_grid_id_seq)))
 WHERE pg_get_serial_sequence('fixed.grid_details', 'grid_id') IS NOT NULL;


-- ── Read-back ──────────────────────────────────────────────────────────────
-- SELECT menu_id, menu_name, menu_visiblity, menu_verbs FROM fixed.menu_master WHERE menu_id = 278;
-- SELECT grid_id, grid_name FROM fixed.grid_details WHERE grid_name LIKE '%TENDER SETTLEMENT%';
