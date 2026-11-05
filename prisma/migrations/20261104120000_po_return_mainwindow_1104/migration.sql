-- ═══════════════════════════════════════════════════════════════════════════
--  PO / Purchase Return / main window, the user's 2026-11-04 list
--  (Shared/Prathap/purchase/plan-po-return-mainwindow-2026-11-04.md §5, step 0a;
--  decisions 15-16: Q1 = a, Q2 = a).
--
--  No new table, no new column, no function, no trigger. Grid and layout rows,
--  and one wording row, only.
--
--  1. Grid 'MAIN LIST - PURCHASE ORDER' (190 on .106; registered through the
--     API by share grids/purchase_po_grn_registration.py, kept in step with
--     this file; not in prisma/seed/Grid_Details.sql). The SELECT list gains
--       po_revision_no  the PO's revision (1 = never amended)
--       po_converted    'CONVERTED' when a live GRN line or purchase-bill line
--                       names the PO (not cancelled, not deleted, DRAFTS
--                       INCLUDED; Q1 = a), else ''. The same documents the
--                       server's poUsedQty / poConversions read.
--     Columns 16 "Rev" (visible, Number, width 4) and 17 "Converted" (hidden,
--     Text). Supplier (7) gives its 4 (22 -> 18) so the visible widths still
--     add to 100. Matched by NAME (ids differ between databases) and guarded
--     on the old text / on the new columns being absent.
--  2. Grid 'POPUP - PURCHASE RETURN BILLS' (197 where free) and
--     3. 'POPUP - PURCHASE RETURN GRNS' (198 where free): the Purchase Return
--     bill picker (Against = Bill / GRN), a supplier's POSTED bills / GRNs
--     with their line count, lines still returnable (in > returned by live
--     returns, drafts included, as the server's returnedQty; for a GRN a line
--     already billed is not open, as billedGrnLines), value and value already
--     returned, and age in days. Tokens, every one always sent ('' = no bound
--     for the dates): icompany_id, ibranch_id, isupplier_id, ifrom_date,
--     ito_date. Filter (search) columns: number, supplier bill / challan,
--     value. The desktop holds 197 / 198 as constants; where an id is taken
--     the sequence picks one, so look the grid up by name there.
--  4. ui_table 59 'PURCHASE RETURN - LINES': + 26..32 at the Qt enum numbers
--     (PurchaseReturnCols after Mrp = 25):
--        26 Barcode   27 Weight   28 Stock   29 Lot stock (hidden)
--        30 Pur. cost 31 Return cost          32 Notes
--     9 Rate is retitled "Bill rate"; 23 Writes is hidden (width 0). Every
--     row is re-ranked to the plan's visible order
--        Barcode Item Batch·Exp Bucket Stock Billed Returned Qty Weight
--        Pur. cost Bill rate Return cost Value GST Outcome Reason Credit to Notes
--     (1..18), then Writes 24 and Lot stock 25 as §5.4 lists them, and the
--     other hidden rows in column-no order on the free slots 19..33. Widths
--     are the mockup's px / 1478 (visible total 98.25). Ids are pinned
--     (2311-2317) and prisma/seed/Ui_Table_Columns.sql carries the same rows;
--     ui_table 59 is seeded, so on a fresh database every statement here
--     no-ops (guarded on its parent) and the seed lays it out.
--  5. Plain wording (notes 120) for PUR_PO_CONVERTED, the amend refusal on a
--     converted PO; catalogue 2026-11-04.2. prisma/seed/Error_Messages.json
--     carries the same row.
--
--  Grid SQL holds no comments (the runner refuses "--" and "/*"). Inserted
--  rows start with *_sync_on NULL (pending), like any new row; the existing
--  zz_sync_mark_dirty triggers mark the updated ones. Re-runnable: every
--  statement is guarded.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0 · pinned ui_table_columns ids must be free (or already ours) ─────────
DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT string_agg(format('ui_table_column %s (table %s no %s)', c.ui_tbl_clm_id, c.ui_tbl_clm_table_id, c.ui_tbl_clm_no), ', ')
      INTO v_clash
      FROM fixed.ui_table_columns c
      JOIN (VALUES
            (2311::bigint, 59::bigint, 26::bigint),
            (2312, 59, 27),
            (2313, 59, 28),
            (2314, 59, 29),
            (2315, 59, 30),
            (2316, 59, 31),
            (2317, 59, 32)
           ) v(id, tbl, no) ON v.id = c.ui_tbl_clm_id
     WHERE (c.ui_tbl_clm_table_id, c.ui_tbl_clm_no) IS DISTINCT FROM (v.tbl, v.no);
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Purchase return columns: ids already taken: %. Pick free ids here and in the seed file.', v_clash;
    END IF;
END $$;


-- ── 1 · grid MAIN LIST - PURCHASE ORDER: revision + converted ──────────────
UPDATE fixed.grid_details
   SET grid_sql = replace(grid_sql,
$mig$po.po_remarks, po.po_created_on$mig$,
$mig$po.po_remarks, po.po_created_on, po.po_revision_no,
       CASE WHEN EXISTS (SELECT 1 FROM purchase.pur_grn_item gri
                           JOIN purchase.pur_grn g ON g.grn_id = gri.gri_grn_id AND g.grn_acc_year = gri.gri_acc_year
                          WHERE gri.gri_src_doc_type = 'PURCHASE_ORDER' AND gri.gri_src_doc_id = po.po_id
                            AND NOT gri.gri_is_deleted AND NOT g.grn_is_deleted AND g.grn_status <> 'CANCELLED')
              OR EXISTS (SELECT 1 FROM purchase.pur_invoice_item pii
                           JOIN purchase.pur_invoice p ON p.pi_id = pii.pii_pi_id AND p.pi_acc_year = pii.pii_acc_year
                          WHERE pii.pii_src_doc_type = 'PURCHASE_ORDER' AND pii.pii_src_doc_id = po.po_id
                            AND NOT pii.pii_is_deleted AND NOT p.pi_is_deleted AND p.pi_status <> 'CANCELLED')
            THEN 'CONVERTED' ELSE '' END AS po_converted$mig$),
       grid_modified_by = 'system',
       grid_modified_on = now()
 WHERE grid_name = 'MAIN LIST - PURCHASE ORDER'
   AND grid_is_deleted = false
   AND position('po.po_remarks, po.po_created_on' IN grid_sql) > 0
   AND position('po_converted' IN grid_sql) = 0
   AND position('po_revision_no' IN grid_sql) = 0;

UPDATE fixed.grid_columns c
   SET grid_column_width       = 18.00,
       grid_column_modified_by = 'system',
       grid_column_modified_on = now()
  FROM fixed.grid_details g
 WHERE g.grid_id = c.grid_id
   AND g.grid_name = 'MAIN LIST - PURCHASE ORDER'
   AND g.grid_is_deleted = false
   AND c.grid_column_is_deleted = false
   AND c.grid_column_sql_field_name = 'sup_name'
   AND c.grid_column_width = 22.00
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns x
                    WHERE x.grid_id = g.grid_id AND x.grid_column_is_deleted = false
                      AND x.grid_column_sql_field_name IN ('po_revision_no', 'po_converted'));

INSERT INTO fixed.grid_columns
       (grid_id, grid_column_number, grid_column_name, grid_column_width,
        grid_column_alignment, grid_column_visibility, grid_column_filter,
        grid_column_group, grid_column_total, grid_column_data_type,
        grid_column_is_deleted, grid_column_position, grid_column_sql_field_name,
        grid_column_created_by)
SELECT g.grid_id, v.col_no, v.col_name, v.width,
       v.align, v.visible, false,
       false, false, v.data_type,
       false, v.col_no, v.field,
       'system'
  FROM fixed.grid_details g
 CROSS JOIN (VALUES
        (16, 'Rev',       4.00::numeric, 'right', true,  'Number', 'po_revision_no'),
        (17, 'Converted', 0.00::numeric, 'left',  false, 'Text',   'po_converted')
       ) AS v(col_no, col_name, width, align, visible, data_type, field)
 WHERE g.grid_name = 'MAIN LIST - PURCHASE ORDER'
   AND g.grid_is_deleted = false
   AND position('po_converted' IN g.grid_sql) > 0
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns x
                    WHERE x.grid_id = g.grid_id AND x.grid_column_is_deleted = false
                      AND (x.grid_column_number = v.col_no OR x.grid_column_sql_field_name = v.field));


-- ── 2 · grid POPUP - PURCHASE RETURN BILLS (197) ──────────────────────────
INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_device_type,
        grid_sort_column, grid_sort_order, grid_sql, grid_status,
        grid_is_deleted, grid_created_by)
SELECT CASE WHEN EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_id = 197)
            THEN nextval(pg_get_serial_sequence('fixed.grid_details', 'grid_id'))
            ELSE 197 END,
       'POPUP - PURCHASE RETURN BILLS',
       'Purchase Return bill picker (menu 25, Against = Bill): a supplier''s POSTED purchase bills with lines, lines still returnable, bill value, value already returned and age. Tokens (send every one; '''' = no date bound): icompany_id, ibranch_id, isupplier_id, ifrom_date, ito_date.',
       'Desktop',
       'pi_doc_date', 'Descending',
       $grid$SELECT pi.pi_id, pi.pi_acc_year, pi.pi_refno, pi.pi_supplier_inv_no, pi.pi_doc_date,
       (SELECT count(*) FROM purchase.pur_invoice_item x
         WHERE x.pii_pi_id = pi.pi_id AND x.pii_acc_year = pi.pi_acc_year AND NOT x.pii_is_deleted) AS pi_line_count,
       (SELECT count(*) FROM purchase.pur_invoice_item x
         WHERE x.pii_pi_id = pi.pi_id AND x.pii_acc_year = pi.pi_acc_year AND NOT x.pii_is_deleted
           AND x.pii_received_qty + x.pii_damaged_qty + x.pii_free_qty >
               COALESCE((SELECT SUM(ri.pri_qty + ri.pri_free_qty) FROM purchase.pur_return_item ri
                           JOIN purchase.pur_return r ON r.pr_id = ri.pri_pr_id AND r.pr_acc_year = ri.pri_acc_year
                          WHERE ri.pri_src_item_id = x.pii_id AND NOT ri.pri_is_deleted AND NOT r.pr_is_deleted
                            AND r.pr_status <> 'CANCELLED'), 0)) AS pi_open_lines,
       pi.pi_net_payable,
       (SELECT COALESCE(SUM(r.pr_return_value + r.pr_claim_value), 0) FROM purchase.pur_return r
         WHERE r.pr_src_doc_id = pi.pi_id AND r.pr_src_acc_year = pi.pi_acc_year
           AND NOT r.pr_is_deleted AND r.pr_status <> 'CANCELLED') AS pi_returned_value,
       (CURRENT_DATE - pi.pi_doc_date) AS pi_age_days
  FROM purchase.pur_invoice pi
 WHERE pi.pi_company_id::text = 'icompany_id' AND pi.pi_branch_id::text = 'ibranch_id'
   AND pi.pi_supplier_id::text = 'isupplier_id'
   AND pi.pi_status = 'POSTED' AND NOT pi.pi_is_deleted
   AND (NULLIF('ifrom_date', '') IS NULL OR pi.pi_doc_date::text >= 'ifrom_date')
   AND (NULLIF('ito_date', '') IS NULL OR pi.pi_doc_date::text <= 'ito_date')
 ORDER BY pi.pi_doc_date DESC, pi.pi_created_on DESC$grid$,
       true, false, 'system'
 WHERE NOT EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_name = 'POPUP - PURCHASE RETURN BILLS');

INSERT INTO fixed.grid_columns
       (grid_id, grid_column_number, grid_column_name, grid_column_width,
        grid_column_alignment, grid_column_visibility, grid_column_filter,
        grid_column_group, grid_column_total, grid_column_data_type,
        grid_column_is_deleted, grid_column_position, grid_column_sql_field_name,
        grid_column_created_by)
SELECT g.grid_id, v.col_no, v.col_name, v.width,
       v.align, v.visible, v.filterable,
       false, false, v.data_type,
       false, v.col_no, v.field,
       'system'
  FROM fixed.grid_details g
 CROSS JOIN (VALUES
        ( 1, 'Id',             0.00::numeric, 'left',  false, false, 'Text',     'pi_id'),
        ( 2, 'Year',           0.00,          'left',  false, false, 'Text',     'pi_acc_year'),
        ( 3, 'Bill No',       27.00,          'left',  true,  true,  'Text',     'pi_refno'),
        ( 4, 'Supplier bill', 14.00,          'left',  true,  true,  'Text',     'pi_supplier_inv_no'),
        ( 5, 'Date',          12.00,          'left',  true,  false, 'Date',     'pi_doc_date'),
        ( 6, 'Lines',          7.00,          'right', true,  false, 'Number',   'pi_line_count'),
        ( 7, 'Open',           7.00,          'right', true,  false, 'Number',   'pi_open_lines'),
        ( 8, 'Bill value',    14.00,          'right', true,  true,  'Currency', 'pi_net_payable'),
        ( 9, 'Returned',      12.00,          'right', true,  false, 'Currency', 'pi_returned_value'),
        (10, 'Age',            7.00,          'right', true,  false, 'Number',   'pi_age_days')
       ) AS v(col_no, col_name, width, align, visible, filterable, data_type, field)
 WHERE g.grid_name = 'POPUP - PURCHASE RETURN BILLS'
   AND g.grid_is_deleted = false
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns c WHERE c.grid_id = g.grid_id);


-- ── 3 · grid POPUP - PURCHASE RETURN GRNS (198) ───────────────────────────
INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_device_type,
        grid_sort_column, grid_sort_order, grid_sql, grid_status,
        grid_is_deleted, grid_created_by)
SELECT CASE WHEN EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_id = 198)
            THEN nextval(pg_get_serial_sequence('fixed.grid_details', 'grid_id'))
            ELSE 198 END,
       'POPUP - PURCHASE RETURN GRNS',
       'Purchase Return bill picker (menu 25, Against = GRN): a supplier''s POSTED GRNs with lines, lines still returnable (a line already billed goes back against the bill, so it is not open), provisional value, value already returned and age. Tokens (send every one; '''' = no date bound): icompany_id, ibranch_id, isupplier_id, ifrom_date, ito_date.',
       'Desktop',
       'grn_doc_date', 'Descending',
       $grid$SELECT g.grn_id, g.grn_acc_year, g.grn_refno, g.grn_challan_no, g.grn_doc_date,
       (SELECT count(*) FROM purchase.pur_grn_item x
         WHERE x.gri_grn_id = g.grn_id AND x.gri_acc_year = g.grn_acc_year AND NOT x.gri_is_deleted) AS grn_line_count,
       (SELECT count(*) FROM purchase.pur_grn_item x
         WHERE x.gri_grn_id = g.grn_id AND x.gri_acc_year = g.grn_acc_year AND NOT x.gri_is_deleted
           AND NOT EXISTS (SELECT 1 FROM purchase.pur_invoice_item b
                             JOIN purchase.pur_invoice p ON p.pi_id = b.pii_pi_id AND p.pi_acc_year = b.pii_acc_year
                            WHERE b.pii_src_doc_type = 'GRN' AND b.pii_src_item_id = x.gri_id
                              AND NOT b.pii_is_deleted AND NOT p.pi_is_deleted AND p.pi_status <> 'CANCELLED')
           AND x.gri_received_qty + x.gri_damaged_qty + x.gri_free_qty >
               COALESCE((SELECT SUM(ri.pri_qty + ri.pri_free_qty) FROM purchase.pur_return_item ri
                           JOIN purchase.pur_return r ON r.pr_id = ri.pri_pr_id AND r.pr_acc_year = ri.pri_acc_year
                          WHERE ri.pri_src_item_id = x.gri_id AND NOT ri.pri_is_deleted AND NOT r.pr_is_deleted
                            AND r.pr_status <> 'CANCELLED'), 0)) AS grn_open_lines,
       g.grn_provisional_value,
       (SELECT COALESCE(SUM(r.pr_return_value + r.pr_claim_value), 0) FROM purchase.pur_return r
         WHERE r.pr_src_doc_id = g.grn_id AND r.pr_src_acc_year = g.grn_acc_year
           AND NOT r.pr_is_deleted AND r.pr_status <> 'CANCELLED') AS grn_returned_value,
       (CURRENT_DATE - g.grn_doc_date) AS grn_age_days
  FROM purchase.pur_grn g
 WHERE g.grn_company_id::text = 'icompany_id' AND g.grn_branch_id::text = 'ibranch_id'
   AND g.grn_supplier_id::text = 'isupplier_id'
   AND g.grn_status = 'POSTED' AND NOT g.grn_is_deleted
   AND (NULLIF('ifrom_date', '') IS NULL OR g.grn_doc_date::text >= 'ifrom_date')
   AND (NULLIF('ito_date', '') IS NULL OR g.grn_doc_date::text <= 'ito_date')
 ORDER BY g.grn_doc_date DESC, g.grn_created_on DESC$grid$,
       true, false, 'system'
 WHERE NOT EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_name = 'POPUP - PURCHASE RETURN GRNS');

INSERT INTO fixed.grid_columns
       (grid_id, grid_column_number, grid_column_name, grid_column_width,
        grid_column_alignment, grid_column_visibility, grid_column_filter,
        grid_column_group, grid_column_total, grid_column_data_type,
        grid_column_is_deleted, grid_column_position, grid_column_sql_field_name,
        grid_column_created_by)
SELECT g.grid_id, v.col_no, v.col_name, v.width,
       v.align, v.visible, v.filterable,
       false, false, v.data_type,
       false, v.col_no, v.field,
       'system'
  FROM fixed.grid_details g
 CROSS JOIN (VALUES
        ( 1, 'Id',                   0.00::numeric, 'left',  false, false, 'Text',     'grn_id'),
        ( 2, 'Year',                 0.00,          'left',  false, false, 'Text',     'grn_acc_year'),
        ( 3, 'GRN No',              27.00,          'left',  true,  true,  'Text',     'grn_refno'),
        ( 4, 'Challan',             14.00,          'left',  true,  true,  'Text',     'grn_challan_no'),
        ( 5, 'Date',                12.00,          'left',  true,  false, 'Date',     'grn_doc_date'),
        ( 6, 'Lines',                7.00,          'right', true,  false, 'Number',   'grn_line_count'),
        ( 7, 'Open',                 7.00,          'right', true,  false, 'Number',   'grn_open_lines'),
        ( 8, 'Value (provisional)', 14.00,          'right', true,  true,  'Currency', 'grn_provisional_value'),
        ( 9, 'Returned',            12.00,          'right', true,  false, 'Currency', 'grn_returned_value'),
        (10, 'Age',                  7.00,          'right', true,  false, 'Number',   'grn_age_days')
       ) AS v(col_no, col_name, width, align, visible, filterable, data_type, field)
 WHERE g.grid_name = 'POPUP - PURCHASE RETURN GRNS'
   AND g.grid_is_deleted = false
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns c WHERE c.grid_id = g.grid_id);

SELECT setval(pg_get_serial_sequence('fixed.grid_details', 'grid_id'),
              GREATEST((SELECT max(grid_id) FROM fixed.grid_details),
                       (SELECT last_value FROM fixed.grid_details_grid_id_seq)))
 WHERE pg_get_serial_sequence('fixed.grid_details', 'grid_id') IS NOT NULL;


-- ── 4 · ui_table 59 PURCHASE RETURN - LINES: titles, widths, positions ─────
UPDATE fixed.ui_table_columns c
   SET ui_tbl_clm_name              = v.name,
       ui_tbl_clm_column_width      = v.width,
       ui_tbl_clm_column_visibility = v.visible,
       ui_tbl_clm_column_position   = v.pos,
       ui_tbl_clm_modified_on       = now(),
       ui_tbl_clm_modified_by       = 'system'
  FROM (VALUES
        (59::bigint, 0::bigint, 'Bill Ln'::text, 0::numeric, false::boolean, 19::integer),
        (59,  1, 'Item',         10.83, true,   2),
        (59,  2, 'Unit',          0,    false, 20),
        (59,  3, 'Batch · Exp',   6.63, true,   3),
        (59,  4, 'Bucket',        4.47, true,   4),
        (59,  5, 'Can Return',    0,    false, 21),
        (59,  6, 'Qty',           3.52, true,   8),
        (59,  7, 'Outcome',       8.93, true,  15),
        (59,  8, 'Claim On',      0,    false, 22),
        (59,  9, 'Bill rate',     4.33, true,  11),
        (59, 10, 'GST %',         0,    false, 23),
        (59, 11, 'Value',         4.60, true,  13),
        (59, 12, 'GST',           3.92, true,  14),
        (59, 13, 'Total',         0,    false, 26),
        (59, 14, 'SrcItemId',     0,    false, 27),
        (59, 15, 'LotId',         0,    false, 28),
        (59, 16, 'UnitTax',       0,    false, 29),
        (59, 17, 'LineId',        0,    false, 30),
        (59, 18, 'Billed',        3.52, true,   6),
        (59, 19, 'Returned',      4.19, true,   7),
        (59, 20, 'Reason',        5.95, true,  16),
        (59, 21, 'ReasonId',      0,    false, 31),
        (59, 22, 'Credit to',     6.50, true,  17),
        (59, 23, 'Writes',        0,    false, 24),
        (59, 24, 'Expiry',        0,    false, 32),
        (59, 25, 'MRP',           0,    false, 33)
       ) v(tbl, no, name, width, visible, pos)
 WHERE c.ui_tbl_clm_table_id = v.tbl
   AND c.ui_tbl_clm_no       = v.no
   AND c.ui_tbl_clm_is_deleted = false
   AND EXISTS (SELECT 1 FROM fixed.ui_tables t WHERE t.ui_tbl_id = v.tbl AND t.ui_tbl_name = 'PURCHASE RETURN - LINES')
   AND NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns n
                    WHERE n.ui_tbl_clm_table_id = v.tbl AND n.ui_tbl_clm_no = 26 AND n.ui_tbl_clm_is_deleted = false)
   AND (c.ui_tbl_clm_name, c.ui_tbl_clm_column_width, c.ui_tbl_clm_column_visibility, c.ui_tbl_clm_column_position)
       IS DISTINCT FROM (v.name, v.width, v.visible, v.pos);


-- ── 5 · ui_table 59: new columns, appended at their enum numbers ───────────
INSERT INTO fixed.ui_table_columns
       (ui_tbl_clm_id, ui_tbl_clm_table_id, ui_tbl_clm_no, ui_tbl_clm_name, ui_tbl_clm_column_width,
        ui_tbl_clm_column_visibility, ui_tbl_clm_column_focus, ui_tbl_clm_column_position,
        ui_tbl_clm_column_necessity, ui_tbl_clm_is_active, ui_tbl_clm_is_deleted, ui_tbl_clm_created_by)
SELECT v.id, v.tbl, v.no, v.name, v.width, v.visible, false, v.pos, false, true, false, 'system'
  FROM (VALUES
        (2311::bigint, 59::bigint, 26::bigint, 'Barcode'::text, 6.09::numeric, true::boolean, 1::integer),
        (2312, 59, 27, 'Weight',      3.65, true,   9),
        (2313, 59, 28, 'Stock',       3.79, true,   5),
        (2314, 59, 29, 'Lot stock',   0,    false, 25),
        (2315, 59, 30, 'Pur. cost',   4.47, true,  10),
        (2316, 59, 31, 'Return cost', 4.74, true,  12),
        (2317, 59, 32, 'Notes',       8.12, true,  18)
       ) v(id, tbl, no, name, width, visible, pos)
 WHERE EXISTS (SELECT 1 FROM fixed.ui_tables t WHERE t.ui_tbl_id = v.tbl AND t.ui_tbl_name = 'PURCHASE RETURN - LINES')
   AND NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns e
                    WHERE e.ui_tbl_clm_table_id = v.tbl AND e.ui_tbl_clm_no = v.no AND e.ui_tbl_clm_is_deleted = false)
ON CONFLICT (ui_tbl_clm_id) DO NOTHING;

SELECT setval('fixed.ui_table_columns_ui_tbl_clm_id_seq',
              GREATEST((SELECT last_value FROM fixed.ui_table_columns_ui_tbl_clm_id_seq),
                       (SELECT COALESCE(MAX(ui_tbl_clm_id), 1) FROM fixed.ui_table_columns)), true);


-- ── 6 · plain wording row (notes 120), catalogue 2026-11-04.2 ──────────────
INSERT INTO fixed.error_message
    (erm_code, erm_variant, erm_lang, erm_title, erm_line, erm_todo)
VALUES
     ('PUR_PO_CONVERTED', '', 'en', 'PO already used', 'Goods or a bill have come in against this PO, so it can''t be changed.', 'Short-close what is still pending, or make a new PO.')
ON CONFLICT (erm_code, erm_variant, erm_lang) DO NOTHING;

UPDATE fixed.error_message_catalogue
   SET emc_version   = '2026-11-04.2',
       emc_row_count = (SELECT count(*) FROM fixed.error_message WHERE erm_is_active),
       emc_loaded_on = now()
 WHERE emc_id = 1
   AND emc_version < '2026-11-04.2';
