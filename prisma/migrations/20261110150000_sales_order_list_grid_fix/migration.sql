-- ═══════════════════════════════════════════════════════════════════════════
--  Sales Order list grid 87: base fix + the user's name in "By"  2026-11-10
--  Plan: Shared/Prathap/sales/plan-sales-order-qt-2026-11-10.md, row 5, and
--  the reviewer's grid 87 finding (agreed with erp-49, who owns SO Management:
--  this migration owns grid 87's base; erp-49 later adds "leave delivery-hold
--  orders out when pending only" on top). Seed data only: no table, column,
--  CHECK, function or trigger.
--
--  Grid 87 "TXN MAIN LIST - SALES ORDER" serves the Sales Order list, the
--  order screen's Ctrl+O picker (TxnDocTypes::salesOrder, ipending_only
--  'false') and the Sale Bill's order import (pendingSalesOrders, 'true').
--  The live SQL was an older cut than the design note
--  (Shared/Prathap/grids/sale_order_list_grid.sql): it listed deleted
--  orders, ignored ipending_only, and no column was searchable, so typing in
--  the search box emptied the list.
--
--  1 · grid_sql, replaced whole, only while it is the known old text
--      (md5 000b6a23..., the seed's). Now:
--      * b.so_is_deleted = false;
--      * "By": LEFT JOIN public.user_master u ON u.usr_id::text =
--        lower(b.so_created_by), COALESCE(u.usr_login_name, b.so_created_by)
--        AS so_created_by. Compared as TEXT, never cast to uuid, so an old
--        row holding a name still shows it; same name and type (varchar);
--        usr_login_name is what the order GET returns as createdByName;
--        usr_id is user_master's key, so no row is doubled;
--      * pending only, one clause on one line:
--          lower(NULLIF('ipending_only','')) IS DISTINCT FROM 'true' OR
--          (so_status IN (CONFIRMED, PARTIAL) AND so_fulfil_status IN
--          (PENDING, PARTIAL))
--        so_status: the statuses a bill may be raised against
--        (bill-lifecycle ORDER_NOT_OPEN: CONFIRMED or PARTIAL; DRAFT,
--        COMPLETED, CANCELLED, CLOSED, EXPIRED refused), so nothing the
--        import offers is then refused. so_fulfil_status: the order roll-up
--        keeps it PENDING / PARTIAL exactly while some line still has
--        pending qty. so_pending_amt is not tested: a line still to deliver
--        at rate 0 would drop out. Anything but 'true' (missing, empty,
--        'false') means no filter;
--      * two more output columns, so_fulfil_status and so_pending_amt.
--      Unchanged: every other column, the tokens icompany_id / ibranch_id /
--      ifrom_date / ito_date, the ORDER BY. No search token: the client
--      sends search= outside grid_param and the runner matches it against
--      the grid's filterable columns (section 2). No comments in grid_sql.
--      A grid 87 whose SQL is neither the old nor the new text is left alone
--      with a WARNING.
--
--  2 · grid_columns of 87: grid_column_filter on Order No (so_order_refno),
--      Customer (cus_name) and Total (so_order_amt), the "party name, order
--      no or amount" the screen's search hint promises.
--
--  3 · grid_columns of 87: number 15 "Delivery" (so_fulfil_status) and 16
--      "Pending" (so_pending_amt), ids pinned, HIDDEN: no screen reads them
--      yet, and the 14 existing columns keep their order and visibility.
--
--  prisma/seed/Grid_Details.sql and Grid_Columns.sql carry the same rows.
--  Re-runnable: every statement is guarded. No sync calls.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · grid 87 SQL ────────────────────────────────────────────────────────
UPDATE fixed.grid_details
   SET grid_sql = $mig$SELECT
	b.so_id,
	b.so_company_id,
	b.so_branch_id,
	b.so_acc_year,
	b.so_order_date,
	b.so_order_refno,
	b.so_order_type,
	c.cus_name,
	c.cus_addr3,
	b.so_tot_items,
	b.so_order_amt,
	b.so_status,
	b.so_print_count,
	COALESCE(u.usr_login_name, b.so_created_by) AS so_created_by,
	b.so_fulfil_status,
	b.so_pending_amt
FROM
	sales.sale_order b
	INNER JOIN sales.customers c on c.cus_id = b.so_cust_id
	LEFT JOIN public.user_master u ON u.usr_id::text = lower(b.so_created_by)
 WHERE
 	b.so_is_deleted = false
 	AND b.so_company_id = 'icompany_id'::uuid
  	AND b.so_branch_id  = 'ibranch_id'::uuid
  	AND (NULLIF('ifrom_date', '') IS NULL OR b.so_order_date >= 'ifrom_date'::date)
  	AND (NULLIF('ito_date',   '') IS NULL OR b.so_order_date <= 'ito_date'::date)
  	AND (lower(NULLIF('ipending_only', '')) IS DISTINCT FROM 'true' OR (b.so_status IN ('CONFIRMED', 'PARTIAL') AND b.so_fulfil_status IN ('PENDING', 'PARTIAL')))
ORDER BY
	b.so_order_date DESC, b.so_order_slno DESC$mig$,
       grid_modified_by = 'system',
       grid_modified_on = now()
 WHERE grid_id = 87
   AND grid_name = 'TXN MAIN LIST - SALES ORDER'
   AND md5(grid_sql) = '000b6a23a2230d183f0b248d881aaac6';

DO $$
DECLARE
    v_md5 text;
BEGIN
    SELECT md5(grid_sql) INTO v_md5 FROM fixed.grid_details WHERE grid_id = 87;
    IF FOUND AND v_md5 IS DISTINCT FROM 'c9971f9dcbd7b1c3fee4f6b3c1041c11' AND v_md5 IS DISTINCT FROM '000b6a23a2230d183f0b248d881aaac6' THEN
        RAISE WARNING 'grid 87: grid_sql is neither the known old text nor the new one (md5 %), left as it is. Check it by hand.', v_md5;
    END IF;
END $$;


-- ── 2 · searchable columns: Order No, Customer, Total ──────────────────────
UPDATE fixed.grid_columns
   SET grid_column_filter      = true,
       grid_column_modified_by = 'system',
       grid_column_modified_on = now()
 WHERE grid_id = 87
   AND grid_column_sql_field_name IN ('so_order_refno', 'cus_name', 'so_order_amt')
   AND grid_column_is_deleted = false
   AND grid_column_filter = false;


-- ── 3 · two hidden columns: Delivery, Pending ─────────────────────────────
INSERT INTO fixed.grid_columns
       (grid_column_id, grid_id, grid_column_number, grid_column_name, grid_column_sql_field_name,
        grid_column_data_type, grid_column_width, grid_column_position, grid_column_alignment,
        grid_column_visibility, grid_column_filter, grid_column_group, grid_column_total,
        grid_column_is_deleted, grid_column_created_by)
SELECT v.id, 87, v.no, v.name, v.fld, 'Text', 9.00, v.pos, v.align, false, false, false, false, false, 'system'
  FROM (VALUES
        ('01a1c46e-6051-76af-9658-aeb520a4f152'::uuid, 15, 'Delivery'::text, 'so_fulfil_status'::text, 15.00::numeric, 'Center'::text),
        ('01a1c46e-6051-76c3-a97d-c0acafe18c7b'::uuid, 16, 'Pending', 'so_pending_amt', 16.00, 'Right')
       ) v(id, no, name, fld, pos, align)
 WHERE EXISTS (SELECT 1 FROM fixed.grid_details d WHERE d.grid_id = 87 AND d.grid_name = 'TXN MAIN LIST - SALES ORDER')
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns e
                    WHERE e.grid_id = 87 AND e.grid_column_is_deleted = false
                      AND (e.grid_column_sql_field_name = v.fld OR e.grid_column_number = v.no))
ON CONFLICT (grid_column_id) DO NOTHING;
