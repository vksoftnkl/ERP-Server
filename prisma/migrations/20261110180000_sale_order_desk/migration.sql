-- ═══════════════════════════════════════════════════════════════════════════
--  Sales Order Management (the SO desk), phase P1 (DB)            2026-11-10
--  Plan: Shared/Prathap/sales/plan-sales-order-management-qt-2026-11-10.md,
--  addendum-1 (the user's answers) and addendum-2 (Q-A/Q-B/Q-C, grid 87
--  branch A); mockup sales_order_management_ui_mockup_v5.png (approved). Ports
--  3.0 menu 172 "SO Pending". Columns, one row-local CHECK and data rows only:
--  no table, index, function or trigger (the two DO blocks are anonymous: the
--  id-clash check and the guarded grid 87 edit). Sorts after
--  20261110170000_app_versioning.
--
--  1 · sales.sale_order (LIST by so_acc_year; the ALTER on the parent reaches
--      every partition, 2024-2025 .. 2027-2028 on dev) gains the delivery hold
--      (plan D4: never "hold", which is txn_hold's word for a parked draft):
--        so_delivery_hold         boolean NOT NULL DEFAULT false
--        so_delivery_hold_reason  varchar(250)  reason of the last hold / release
--        so_delivery_hold_by      varchar(50)   who, as text like so_modified_by
--        so_delivery_hold_on      timestamptz   when
--      ck_so_delivery_hold: a held order names a non-blank reason and a time.
--      Row-local, so a synced row can never fail it; no UNIQUE, no index (D14).
--      No new table, so db_table_master (row 622) and
--      ensure_acc_year_partitions are not touched.
--
--  2 · menu 299 "Sales Order Management" under &1 Sales at 31.00, after 11
--      Sales Order (30.00), before 226 Delivery Status (40.00). Verbs {VIEW}
--      only: every action is judged on menu 11 (and 12 / 99 / 258 / 279) rights
--      (D6). Grants: every live menu 11 row with View gets a VIEW-only 299 row
--      (dev: 7 users), plus a VIEW-only parent 1 row where one is missing.
--
--  3 · grids 201 / 202 / 203 (the desk list, the beat tree, the Not ordered
--      popup), SQL as addendum-1 §4.1: NO money column in any row (D24 / D34;
--      amounts come only from POST /sale-order-desk/figures behind menu 99
--      View), and each emits a rank (desk_rank / beat_rank / cus_rank) to send
--      as sort_by, because the runner drops an inner ORDER BY (D29). Optional
--      tokens are compared as text and never cast; icompany_id / ibranch_id are
--      always real uuids and are cast, as grid 87 / 116 do, so ix_so_list
--      stays usable. Every caller sends every token ('' = off). No comments in
--      grid_sql. Their grid_columns (40 / 15 / 12) have ids pinned after the
--      live max uuidv7 (grid 198's, 2026-11-10 16:02). 197 / 198 are not used.
--
--  4 · grid 87 "TXN MAIN LIST - SALES ORDER" (D35, branch A): erp-dd's
--      20261110150000_sales_order_list_grid_fix owns the base. This adds ONE
--      predicate, b.so_delivery_hold = false, inside its ipending_only clause,
--      so the Sale Bill's pending-orders picker leaves held orders out. Exact
--      text replace of the whole clause; stops if the clause is not there
--      exactly once. Skipped when grid 87 is absent (a fresh database seeds it
--      later from Grid_Details.sql, which carries the same text).
--
--  5 · ui_table 70 "SALE ORDER DESK - LIST" (read-only, Desktop), columns
--      2429-2476: ui_tbl_clm_no 0..13 shown (the Qt SaleOrderDeskCols enum;
--      mockup widths with Customer 11.95 and Place 7.11, adding up to 95.00 so
--      the row gutter fits, as table 69 learned in 20261110140000), 14..47
--      hidden. No column takes focus.
--
--  6 · fixed.error_message: the 12 new SALES_ORDER_* codes (addendum-1 §4.5)
--      and SALE_ORDER_ADVANCE_HELD (thrown today, no row yet); catalogue
--      2026-11-10.1.
--
--  Ids are PINNED; the same rows are in prisma/seed (Menu_Master.sql,
--  Ui_Tables.sql, Ui_Table_Columns.sql, Grid_Details.sql for grid 87,
--  Error_Messages.json). Grids 201-203 live in this migration only, as every
--  grid after 132 does. On a fresh database menu 1 is seeded after migrations,
--  so menu 299 and its grants come from the seed there. An id already taken by
--  something else stops the migration. Re-runnable: every statement is guarded.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 0 · pinned ids must be free (or already ours) ──────────────────────────
DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT string_agg(x, '; ') INTO v_clash FROM (
        SELECT format('menu %s (%s)', m.menu_id, m.menu_name) AS x
          FROM fixed.menu_master m
         WHERE m.menu_id = 299
           AND m.menu_name <> 'Sales Order Management'
        UNION ALL
        SELECT format('grid %s (%s)', d.grid_id, d.grid_name)
          FROM fixed.grid_details d
          JOIN (VALUES
                (201::bigint, 'MAIN LIST - SALE ORDER DESK'::text),
                (202, 'SALE ORDER DESK - BEATS'),
                (203, 'SALE ORDER DESK - NOT ORDERED')
               ) v(id, name) ON v.id = d.grid_id
         WHERE d.grid_name IS DISTINCT FROM v.name
        UNION ALL
        SELECT format('grid_column %s (grid %s no %s)', c.grid_column_id, c.grid_id, c.grid_column_number)
          FROM fixed.grid_columns c
          JOIN (VALUES
                ('01a1c515-a045-7700-b3f8-e26a1d30da3a'::uuid, 201::bigint, 1::integer),
                ('01a1c515-a045-7713-baa5-aab1da553371', 201, 2),
                ('01a1c515-a045-7719-ba26-1e3fe4f5ffa4', 201, 3),
                ('01a1c515-a045-771e-8156-a16db38a175b', 201, 4),
                ('01a1c515-a045-7722-9897-e36765fa05b3', 201, 5),
                ('01a1c515-a045-7726-9692-7b0b630cb48c', 201, 6),
                ('01a1c515-a045-772a-95bc-48372e155f4f', 201, 7),
                ('01a1c515-a045-772e-8d5a-0b30352d6562', 201, 8),
                ('01a1c515-a045-7732-a23e-33ea7ca585c3', 201, 9),
                ('01a1c515-a045-7736-9864-b7c00359d21f', 201, 10),
                ('01a1c515-a045-773a-8c1d-cb57c3fc57cb', 201, 11),
                ('01a1c515-a045-773f-80ff-9b4612925f81', 201, 12),
                ('01a1c515-a045-7743-83e7-a4aee92ff890', 201, 13),
                ('01a1c515-a045-7747-9427-13e17626a602', 201, 14),
                ('01a1c515-a045-774b-a6f0-ff83f0226cf4', 201, 15),
                ('01a1c515-a045-774f-8e35-e2dca4aa95db', 201, 16),
                ('01a1c515-a045-7753-83f1-b722e6eb3882', 201, 17),
                ('01a1c515-a045-7757-be3d-d4d5fb2459b3', 201, 18),
                ('01a1c515-a045-775b-b7ed-d3dea6bb7398', 201, 19),
                ('01a1c515-a045-775f-a588-422c3b27e7e6', 201, 20),
                ('01a1c515-a045-7763-b66c-136d5d0d8f92', 201, 21),
                ('01a1c515-a045-7767-ade0-c2d6575c54fb', 201, 22),
                ('01a1c515-a045-776b-8ac6-47226c20763d', 201, 23),
                ('01a1c515-a045-776f-a520-e01c1f1b8e24', 201, 24),
                ('01a1c515-a045-7774-b33d-1d5bd0f1af43', 201, 25),
                ('01a1c515-a045-7778-b1b5-842912e1b40a', 201, 26),
                ('01a1c515-a045-777c-93e8-56c46fc369f2', 201, 27),
                ('01a1c515-a045-7780-a71d-7c8444fa7b8e', 201, 28),
                ('01a1c515-a045-7784-ab62-76c6a69f1940', 201, 29),
                ('01a1c515-a045-7788-8de4-5f5be318f2f1', 201, 30),
                ('01a1c515-a045-778c-bc5e-98e08275c00c', 201, 31),
                ('01a1c515-a045-7791-8560-7c0ea6742402', 201, 32),
                ('01a1c515-a045-7795-be2f-f04fb4bbadc9', 201, 33),
                ('01a1c515-a045-7799-8a09-8d35a0ed3036', 201, 34),
                ('01a1c515-a045-779d-b92b-25156050e4d1', 201, 35),
                ('01a1c515-a045-77a1-bb1c-a803202563cd', 201, 36),
                ('01a1c515-a045-77a5-9f46-9afef7cd3d50', 201, 37),
                ('01a1c515-a045-77a9-a66f-3a54d33c6eed', 201, 38),
                ('01a1c515-a045-77ad-923d-4b62e78e9853', 201, 39),
                ('01a1c515-a045-77b2-9bfb-2a850f3b3f03', 201, 40),
                ('01a1c515-a045-77b6-bc41-e250a872671c', 202, 1),
                ('01a1c515-a045-77ba-a908-3a1a6b4ed951', 202, 2),
                ('01a1c515-a045-77be-8753-8e857eb079e8', 202, 3),
                ('01a1c515-a045-77c2-9b19-d97fe30174f1', 202, 4),
                ('01a1c515-a045-77c6-b3af-92b6392c7250', 202, 5),
                ('01a1c515-a045-77ca-b19e-75fdee3d9ce9', 202, 6),
                ('01a1c515-a045-77ce-89dd-25a993ad3486', 202, 7),
                ('01a1c515-a045-77d2-81ed-434ec0ea418e', 202, 8),
                ('01a1c515-a045-77d7-97f8-c89865b0d3b3', 202, 9),
                ('01a1c515-a045-77db-b281-171ab2cb2bec', 202, 10),
                ('01a1c515-a045-77df-b734-a307d99592a0', 202, 11),
                ('01a1c515-a045-77e3-8c4b-b0f670bf7da5', 202, 12),
                ('01a1c515-a045-77e7-a945-55d3e38e5c0c', 202, 13),
                ('01a1c515-a045-77eb-b749-020ae7b879c8', 202, 14),
                ('01a1c515-a045-77ef-9867-890b57f024c3', 202, 15),
                ('01a1c515-a045-77f3-957a-10921048025e', 203, 1),
                ('01a1c515-a045-77f7-a76d-584603b44b42', 203, 2),
                ('01a1c515-a045-77fb-9638-0481b207288e', 203, 3),
                ('01a1c515-a045-77ff-9775-779c4ada1e0c', 203, 4),
                ('01a1c515-a045-7804-b1fe-21846d37dc79', 203, 5),
                ('01a1c515-a045-7808-bd86-398a7daaff2a', 203, 6),
                ('01a1c515-a045-780c-b345-91b6fce1a5a4', 203, 7),
                ('01a1c515-a045-7810-ad73-0d9875d6c301', 203, 8),
                ('01a1c515-a045-7814-8cd8-b1effc75a32a', 203, 9),
                ('01a1c515-a045-7818-a047-d9730b707b15', 203, 10),
                ('01a1c515-a045-781c-9152-ac44272025cf', 203, 11),
                ('01a1c515-a045-7820-9151-7b2f1cee2304', 203, 12)
               ) v(id, grid, no) ON v.id = c.grid_column_id
         WHERE (c.grid_id, c.grid_column_number) IS DISTINCT FROM (v.grid, v.no)
        UNION ALL
        SELECT format('ui_table %s (%s)', t.ui_tbl_id, t.ui_tbl_name)
          FROM fixed.ui_tables t
         WHERE t.ui_tbl_id = 70
           AND t.ui_tbl_name IS DISTINCT FROM 'SALE ORDER DESK - LIST'
        UNION ALL
        SELECT format('ui_table_column %s (table %s no %s)', c.ui_tbl_clm_id, c.ui_tbl_clm_table_id, c.ui_tbl_clm_no)
          FROM fixed.ui_table_columns c
          JOIN (VALUES
                (2429::bigint, 70::bigint, 0::bigint),
                (2430, 70, 1),
                (2431, 70, 2),
                (2432, 70, 3),
                (2433, 70, 4),
                (2434, 70, 5),
                (2435, 70, 6),
                (2436, 70, 7),
                (2437, 70, 8),
                (2438, 70, 9),
                (2439, 70, 10),
                (2440, 70, 11),
                (2441, 70, 12),
                (2442, 70, 13),
                (2443, 70, 14),
                (2444, 70, 15),
                (2445, 70, 16),
                (2446, 70, 17),
                (2447, 70, 18),
                (2448, 70, 19),
                (2449, 70, 20),
                (2450, 70, 21),
                (2451, 70, 22),
                (2452, 70, 23),
                (2453, 70, 24),
                (2454, 70, 25),
                (2455, 70, 26),
                (2456, 70, 27),
                (2457, 70, 28),
                (2458, 70, 29),
                (2459, 70, 30),
                (2460, 70, 31),
                (2461, 70, 32),
                (2462, 70, 33),
                (2463, 70, 34),
                (2464, 70, 35),
                (2465, 70, 36),
                (2466, 70, 37),
                (2467, 70, 38),
                (2468, 70, 39),
                (2469, 70, 40),
                (2470, 70, 41),
                (2471, 70, 42),
                (2472, 70, 43),
                (2473, 70, 44),
                (2474, 70, 45),
                (2475, 70, 46),
                (2476, 70, 47)
               ) v(id, tbl, no) ON v.id = c.ui_tbl_clm_id
         WHERE (c.ui_tbl_clm_table_id, c.ui_tbl_clm_no) IS DISTINCT FROM (v.tbl, v.no)
        UNION ALL
        SELECT format('error code %s (worded "%s")', e.erm_code, e.erm_line)
          FROM fixed.error_message e
          JOIN (VALUES
                ('SALES_ORDER_DELIVERY_HOLD'::text, 'On delivery hold'::text, 'This order is on delivery hold.'::text, 'Release it on Sales Order Management first.'::text),
                ('SALES_ORDER_HOLD_UNCHANGED', 'Already done', 'Someone already put this order on delivery hold, or released it.', 'Refresh the list to see it.'),
                ('SALES_ORDER_PRIORITY_UNCHANGED', 'Already done', 'This order is already marked that way.', 'Refresh the list to see it.'),
                ('SALES_ORDER_CLOSED', 'Order closed', 'Nothing is left open on this order.', 'Refresh the list.'),
                ('SALES_ORDER_REASON_REQUIRED', 'Reason needed', 'Say why.', 'Type the reason, then try again.'),
                ('SALES_ORDER_MERGE_TOO_FEW', 'Cannot merge', 'Merge needs 2 or more orders.', 'Tick 2 or more orders of one customer.'),
                ('SALES_ORDER_MERGE_ONE_PARTY', 'Cannot merge', 'These orders are for different customers.', 'Tick orders of one customer only.'),
                ('SALES_ORDER_MERGE_TERMS_DIFFER', 'Cannot merge', 'These orders differ in cash / credit, order type or place of supply.', 'Merge only orders with the same terms.'),
                ('SALES_ORDER_MERGE_ADVANCE', 'Cannot merge', 'One of these orders holds an advance payment.', 'Refund or move the advance first, or leave that order out.'),
                ('SALES_ORDER_MERGE_CHARGES', 'Cannot merge', 'One of these orders has charges on the whole order (freight, loading, other).', 'Remove them in the order first, or leave that order out.'),
                ('SALES_ORDER_MERGE_SOURCE_CHANGED', 'Changed meanwhile', 'An order changed while you merged it (a bill took some of it).', 'Close and merge again.'),
                ('SALES_ORDER_MONEY_RIGHT', 'Amounts hidden', 'You have no right to see amounts and dues here.', 'Call manager (Receipt view right).'),
                ('SALE_ORDER_ADVANCE_HELD', 'Advance held', 'This order still holds an advance payment.', 'Refund or move the advance first.')
               ) v(code, title, line, todo) ON v.code = e.erm_code
         WHERE e.erm_variant = '' AND e.erm_lang = 'en'
           AND (e.erm_title, e.erm_line, e.erm_todo)::text IS DISTINCT FROM (v.title, v.line, v.todo)::text
    ) c;
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Sales Order Management: ids already taken: %. Pick free ids here, in the seed files and in the Qt screen.', v_clash;
    END IF;
END $$;


-- ── 1 · delivery hold on sales.sale_order (every partition) ───────────────
ALTER TABLE sales.sale_order
  ADD COLUMN IF NOT EXISTS so_delivery_hold        boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS so_delivery_hold_reason varchar(250) NULL,
  ADD COLUMN IF NOT EXISTS so_delivery_hold_by     varchar(50)  NULL,
  ADD COLUMN IF NOT EXISTS so_delivery_hold_on     timestamptz  NULL;

ALTER TABLE sales.sale_order DROP CONSTRAINT IF EXISTS ck_so_delivery_hold;
ALTER TABLE sales.sale_order ADD CONSTRAINT ck_so_delivery_hold CHECK (
  NOT so_delivery_hold
  OR (so_delivery_hold_reason IS NOT NULL AND btrim(so_delivery_hold_reason) <> '' AND so_delivery_hold_on IS NOT NULL));


-- ── 2 · menu 299 and its rights ────────────────────────────────────────────
INSERT INTO fixed.menu_master
       (menu_id, menu_parent, menu_name, menu_alias, menu_visiblity, menu_position, menu_is_active,
        menu_separator, menu_verbs, menu_created_on, menu_modified_on)
SELECT 299, 1, 'Sales Order Management', NULL, true, 31.00, true, false, '{VIEW}'::text[], now(), now()
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 1)
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 299);

SELECT setval('fixed.menu_master_menu_id_seq',
              GREATEST((SELECT COALESCE(max(menu_id), 0) FROM fixed.menu_master),
                       (SELECT last_value FROM fixed.menu_master_menu_id_seq)));

-- Menu 11's live View grants, VIEW only (the menu holds no other verb).
INSERT INTO public.user_menus
       (um_user_id, um_menu_id, um_can_view, um_can_create, um_can_edit, um_can_delete,
        um_can_print, um_can_export, um_visibility, um_is_favourite, um_is_pinned,
        um_sort_order, um_is_deleted, um_created_by, um_can_post, um_can_cancel,
        um_can_amend, um_can_override, um_can_retender)
SELECT u.um_user_id, 299, true, false, false, false,
       false, false, u.um_visibility, false, false,
       u.um_sort_order, false, u.um_created_by, false, false,
       false, false, false
  FROM public.user_menus u
 WHERE u.um_menu_id = 11
   AND u.um_is_deleted = false
   AND u.um_can_view = true
   AND EXISTS (SELECT 1 FROM fixed.menu_master m WHERE m.menu_id = 299 AND m.menu_name = 'Sales Order Management')
ON CONFLICT (um_user_id, um_menu_id) DO NOTHING;

-- The parent folder, VIEW only, for a grantee without one (else the tree is empty).
INSERT INTO public.user_menus
       (um_user_id, um_menu_id, um_can_view, um_visibility, um_created_by)
SELECT n.um_user_id, 1, true, true, n.um_created_by
  FROM public.user_menus n
 WHERE n.um_menu_id = 299
   AND n.um_is_deleted = false
   AND NOT EXISTS (SELECT 1 FROM public.user_menus p WHERE p.um_user_id = n.um_user_id AND p.um_menu_id = 1)
ON CONFLICT (um_user_id, um_menu_id) DO NOTHING;


-- ── 3 · grids 201 / 202 / 203 and their columns ────────────────────────────
INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_sort_column, grid_sort_order, grid_device_type,
        grid_status, grid_is_deleted, grid_created_by, grid_sql)
VALUES (201, 'MAIN LIST - SALE ORDER DESK',
        'Sales Order Management (menu 299): confirmed / part-billed orders of this branch with an open line, all years unless iacc_year is set, no amounts (they come from POST /sale-order-desk/figures). Page with sort_by=desk_rank, sort_dir=asc. Tokens (send every one; '''' = off): icompany_id, ibranch_id, iacc_year, iarea_ids (comma-separated arm_id), iitem_id, iquick / ipartial / idup (''true'' = on).',
        'desk_rank', 'Ascending', 'Desktop', true, false, 'system', $mig$WITH ord AS (
  SELECT so.so_id, so.so_company_id, so.so_branch_id, so.so_acc_year, so.so_order_refno,
         so.so_order_date, so.so_order_datetime, so.so_cust_id, so.so_cust_place, so.so_cust_phone,
         so.so_priority, so.so_status, so.so_print_count, so.so_packed_id,
         so.so_delivery_hold, so.so_delivery_hold_reason, so.so_delivery_hold_by, so.so_delivery_hold_on,
         l.open_items, l.open_qty, l.open_kg, l.open_value, l.order_open_value,
         l.big_items, l.rate_changed, l.is_part_billed,
         COUNT(*) OVER (PARTITION BY so.so_cust_id) AS cust_open_orders
    FROM sales.sale_order so
    JOIN LATERAL (
      SELECT COUNT(*) FILTER (WHERE d.soi_pending_qty > 0 AND ('iitem_id' = '' OR d.soi_item_id::text = 'iitem_id')) AS open_items,
             COALESCE(SUM(d.soi_pending_qty) FILTER (WHERE d.soi_pending_qty > 0 AND ('iitem_id' = '' OR d.soi_item_id::text = 'iitem_id')), 0) AS open_qty,
             COALESCE(SUM(d.soi_pending_qty * COALESCE(u.iuc_uom_weight, 0)) FILTER (WHERE d.soi_pending_qty > 0 AND ('iitem_id' = '' OR d.soi_item_id::text = 'iitem_id')), 0) AS open_kg,
             COALESCE(SUM(CASE WHEN d.soi_net_qty > 0 THEN d.soi_net_amt * d.soi_pending_qty / d.soi_net_qty ELSE 0 END) FILTER (WHERE d.soi_pending_qty > 0 AND ('iitem_id' = '' OR d.soi_item_id::text = 'iitem_id')), 0) AS open_value,
             COALESCE(SUM(CASE WHEN d.soi_net_qty > 0 THEN d.soi_net_amt * d.soi_pending_qty / d.soi_net_qty ELSE 0 END) FILTER (WHERE d.soi_pending_qty > 0), 0) AS order_open_value,
             COUNT(*) FILTER (WHERE d.soi_pending_qty > 0 AND ('iitem_id' = '' OR d.soi_item_id::text = 'iitem_id') AND u.iuc_is_big_unit) AS big_items,
             COUNT(*) FILTER (WHERE d.soi_pending_qty > 0 AND ('iitem_id' = '' OR d.soi_item_id::text = 'iitem_id') AND d.soi_rate_diff <> 0) AS rate_changed,
             COALESCE(bool_or(d.soi_delivered_qty > 0), false) AS is_part_billed
        FROM sales.sale_order_item d
        LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = d.soi_item_unit_id
       WHERE d.soi_order_id = so.so_id AND d.soi_acc_year = so.so_acc_year AND d.soi_is_deleted = false
    ) l ON l.open_items > 0
   WHERE so.so_company_id = 'icompany_id'::uuid
     AND so.so_branch_id = 'ibranch_id'::uuid
     AND so.so_is_deleted = false
     AND so.so_status IN ('CONFIRMED', 'PARTIAL')
     AND ('iacc_year' = '' OR so.so_acc_year = 'iacc_year')
),
dues AS (
  SELECT b.abl_party_id,
         SUM(b.abl_pending_amount) AS cus_pending,
         COUNT(*) AS cus_open_bills,
         COALESCE(SUM(b.abl_pending_amount) FILTER (WHERE b.abl_due_date <= CURRENT_DATE), 0) AS cus_overdue,
         COUNT(*) FILTER (WHERE b.abl_due_date <= CURRENT_DATE) AS cus_overdue_bills,
         MIN(b.abl_doc_date) AS oldest_date
    FROM accounts.acc_bill_balance b
   WHERE b.abl_company_id = 'icompany_id'::uuid
     AND b.abl_party_id IN (SELECT o.so_cust_id FROM ord o)
     AND b.abl_dr_cr = 'DR'
     AND b.abl_is_deleted = false
     AND b.abl_is_active = true
     AND b.abl_pending_amount > 0
   GROUP BY b.abl_party_id
)
SELECT o.so_id, o.so_company_id, o.so_branch_id, o.so_acc_year,
       o.so_order_refno, o.so_order_date, o.so_cust_id, c.cus_name,
       COALESCE(NULLIF(btrim(o.so_cust_place), ''), NULLIF(btrim(c.cus_city), ''), a.arm_name) AS cus_place,
       COALESCE(NULLIF(btrim(o.so_cust_phone), ''), c.cus_phone1) AS cus_phone,
       a.arm_id, a.arm_name, ct.ctm_id, ct.ctm_name,
       CASE WHEN o.so_delivery_hold THEN 'DELIVERY HOLD'
            WHEN o.is_part_billed THEN 'PART-BILLED'
            ELSE 'FRESH' END AS desk_status,
       o.is_part_billed, o.so_status, o.so_priority, (o.so_priority = 'URGENT') AS is_quick,
       o.so_delivery_hold, o.so_delivery_hold_reason,
       COALESCE(hu.usr_login_name, o.so_delivery_hold_by) AS hold_by_name,
       to_char(o.so_delivery_hold_on AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY HH12:MI AM') AS hold_on,
       o.open_items, round(o.open_qty, 3) AS open_qty, round(o.open_kg, 3) AS open_kg,
       (o.rate_changed > 0) AS rate_changed,
       CASE WHEN COALESCE(cardinality(o.so_packed_id), 0) > 0 OR o.big_items = o.open_items
            THEN 'PACKED' ELSE 'PENDING' END AS packing,
       o.so_print_count, o.cust_open_orders,
       COALESCE(du.cus_open_bills, 0) AS cus_open_bills, COALESCE(du.cus_overdue_bills, 0) AS cus_overdue_bills,
       (CURRENT_DATE - du.oldest_date) AS cus_oldest_days,
       (c.cus_credit_amt_limit > 0) AS has_credit_limit, c.cus_credit_bill_limit, c.cus_credit_days,
       (c.cus_credit_amt_limit > 0
        AND COALESCE(du.cus_pending, 0) + o.order_open_value > c.cus_credit_amt_limit) AS is_credit_limit,
       (c.cus_credit_bill_limit > 0
        AND COALESCE(du.cus_open_bills, 0) >= c.cus_credit_bill_limit) AS is_bill_limit,
       (c.cus_credit_days > 0 AND du.oldest_date IS NOT NULL
        AND CURRENT_DATE - du.oldest_date > c.cus_credit_days) AS is_days_over,
       row_number() OVER (ORDER BY CASE WHEN 'idup' = 'true' THEN c.cus_name END,
                          o.so_order_date DESC, o.so_order_datetime DESC, o.so_id) AS desk_rank
  FROM ord o
  JOIN sales.customers c ON c.cus_id = o.so_cust_id
  JOIN sales.area_master a ON a.arm_id = c.cus_area_id
  LEFT JOIN sales.city_master ct ON ct.ctm_id = a.arm_city_id
  LEFT JOIN dues du ON du.abl_party_id = o.so_cust_id
  LEFT JOIN public.user_master hu ON hu.usr_id::text = lower(o.so_delivery_hold_by)
 WHERE ('iarea_ids' = '' OR a.arm_id::text = ANY (string_to_array('iarea_ids', ',')))
   AND ('iquick' <> 'true' OR o.so_priority = 'URGENT')
   AND ('ipartial' <> 'true' OR o.is_part_billed)
   AND ('idup' <> 'true' OR o.cust_open_orders > 1)$mig$)
ON CONFLICT (grid_id) DO NOTHING;

INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_sort_column, grid_sort_order, grid_device_type,
        grid_status, grid_is_deleted, grid_created_by, grid_sql)
VALUES (202, 'SALE ORDER DESK - BEATS',
        'Sales Order Management (menu 299) beat tree: one row per area with open orders, city then area. so_count / so_kg / so_ton follow the iquick / ipartial / idup filters; all_count and the *_count columns count the whole open book. Page with sort_by=beat_rank. Tokens (send every one; '''' = off): icompany_id, ibranch_id, iacc_year, iitem_id, iquick, ipartial, idup.',
        'beat_rank', 'Ascending', 'Desktop', true, false, 'system', $mig$WITH ord AS (
  SELECT so.so_id, so.so_cust_id, so.so_priority, so.so_delivery_hold,
         c.cus_area_id,
         l.open_kg, l.is_part_billed,
         COUNT(*) OVER (PARTITION BY so.so_cust_id) AS cust_open_orders
    FROM sales.sale_order so
    JOIN sales.customers c ON c.cus_id = so.so_cust_id
    JOIN LATERAL (
      SELECT COUNT(*) FILTER (WHERE d.soi_pending_qty > 0 AND ('iitem_id' = '' OR d.soi_item_id::text = 'iitem_id')) AS open_items,
             COALESCE(SUM(d.soi_pending_qty * COALESCE(u.iuc_uom_weight, 0)) FILTER (WHERE d.soi_pending_qty > 0 AND ('iitem_id' = '' OR d.soi_item_id::text = 'iitem_id')), 0) AS open_kg,
             COALESCE(bool_or(d.soi_delivered_qty > 0), false) AS is_part_billed
        FROM sales.sale_order_item d
        LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = d.soi_item_unit_id
       WHERE d.soi_order_id = so.so_id AND d.soi_acc_year = so.so_acc_year AND d.soi_is_deleted = false
    ) l ON l.open_items > 0
   WHERE so.so_company_id = 'icompany_id'::uuid
     AND so.so_branch_id = 'ibranch_id'::uuid
     AND so.so_is_deleted = false
     AND so.so_status IN ('CONFIRMED', 'PARTIAL')
     AND ('iacc_year' = '' OR so.so_acc_year = 'iacc_year')
),
shown AS (
  SELECT o.*,
         (('iquick' <> 'true' OR o.so_priority = 'URGENT')
          AND ('ipartial' <> 'true' OR o.is_part_billed)
          AND ('idup' <> 'true' OR o.cust_open_orders > 1)) AS is_shown
    FROM ord o
)
SELECT ct.ctm_id, ct.ctm_name, ct.ctm_order, a.arm_id, a.arm_name, a.arm_sort,
       COUNT(*) FILTER (WHERE s.is_shown) AS so_count,
       round(COALESCE(SUM(s.open_kg) FILTER (WHERE s.is_shown), 0), 3) AS so_kg,
       round(COALESCE(SUM(s.open_kg) FILTER (WHERE s.is_shown), 0) / 1000, 2) AS so_ton,
       COUNT(*) AS all_count,
       COUNT(*) FILTER (WHERE s.so_priority = 'URGENT') AS quick_count,
       COUNT(*) FILTER (WHERE s.is_part_billed) AS partial_count,
       COUNT(*) FILTER (WHERE s.so_delivery_hold) AS hold_count,
       COUNT(DISTINCT s.so_cust_id) FILTER (WHERE s.cust_open_orders > 1) AS dup_cust_count,
       row_number() OVER (ORDER BY ct.ctm_order, ct.ctm_name, a.arm_sort, a.arm_name, a.arm_id) AS beat_rank
  FROM shown s
  JOIN sales.area_master a ON a.arm_id = s.cus_area_id
  LEFT JOIN sales.city_master ct ON ct.ctm_id = a.arm_city_id
 GROUP BY ct.ctm_id, ct.ctm_name, ct.ctm_order, a.arm_id, a.arm_name, a.arm_sort$mig$)
ON CONFLICT (grid_id) DO NOTHING;

INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_sort_column, grid_sort_order, grid_device_type,
        grid_status, grid_is_deleted, grid_created_by, grid_sql)
VALUES (203, 'SALE ORDER DESK - NOT ORDERED',
        'Sales Order Management (menu 299) Not ordered popup: active customers of this company / branch (or shared) in the ticked beats with no confirmed or part-billed order left open. Page with sort_by=cus_rank. Tokens (send every one; '''' = off): icompany_id, ibranch_id, iacc_year, iarea_ids.',
        'cus_rank', 'Ascending', 'Desktop', true, false, 'system', $mig$SELECT c.cus_id, c.cus_code, c.cus_name,
       COALESCE(NULLIF(btrim(c.cus_city), ''), a.arm_name) AS cus_place,
       c.cus_phone1, a.arm_id, a.arm_name, ct.ctm_name,
       c.cus_billed_date,
       lo.last_order_date,
       (CURRENT_DATE - lo.last_order_date) AS days_since_order,
       row_number() OVER (ORDER BY ct.ctm_order, a.arm_sort, a.arm_name, c.cus_sort_order, c.cus_name, c.cus_id) AS cus_rank
  FROM sales.customers c
  JOIN sales.area_master a ON a.arm_id = c.cus_area_id
  LEFT JOIN sales.city_master ct ON ct.ctm_id = a.arm_city_id
  LEFT JOIN LATERAL (
    SELECT MAX(h.so_order_date) AS last_order_date
      FROM sales.sale_order h
     WHERE h.so_cust_id = c.cus_id
       AND h.so_company_id = 'icompany_id'::uuid
       AND h.so_branch_id = 'ibranch_id'::uuid
       AND h.so_is_deleted = false
       AND h.so_status <> 'DRAFT'
  ) lo ON true
 WHERE c.cus_is_active = true
   AND c.cus_is_deleted = false
   AND (c.cus_company_id IS NULL OR c.cus_company_id = 'icompany_id'::uuid)
   AND (c.cus_branch_id IS NULL OR c.cus_branch_id = 'ibranch_id'::uuid)
   AND ('iarea_ids' = '' OR a.arm_id::text = ANY (string_to_array('iarea_ids', ',')))
   AND NOT EXISTS (
     SELECT 1
       FROM sales.sale_order so
       JOIN sales.sale_order_item d
         ON d.soi_order_id = so.so_id AND d.soi_acc_year = so.so_acc_year
        AND d.soi_is_deleted = false AND d.soi_pending_qty > 0
      WHERE so.so_cust_id = c.cus_id
        AND so.so_company_id = 'icompany_id'::uuid
        AND so.so_branch_id = 'ibranch_id'::uuid
        AND so.so_is_deleted = false
        AND so.so_status IN ('CONFIRMED', 'PARTIAL')
        AND ('iacc_year' = '' OR so.so_acc_year = 'iacc_year'))$mig$)
ON CONFLICT (grid_id) DO NOTHING;

INSERT INTO fixed.grid_columns
       (grid_column_id, grid_id, grid_column_number, grid_column_name, grid_column_sql_field_name,
        grid_column_data_type, grid_column_width, grid_column_position, grid_column_alignment,
        grid_column_visibility, grid_column_filter, grid_column_group, grid_column_total,
        grid_column_is_deleted, grid_column_created_by)
SELECT v.id, v.grid, v.no, v.name, v.fld, v.typ, v.width, v.pos, v.align, v.visible, v.filter, false, false, false, 'system'
  FROM (VALUES
        ('01a1c515-a045-7700-b3f8-e26a1d30da3a'::uuid, 201::bigint, 1::integer, '#'::text, 'so_id'::text, 'Text'::text, 0.00::numeric, 1.00::numeric, 'Left'::text, false::boolean, false::boolean),
        ('01a1c515-a045-7713-baa5-aab1da553371', 201, 2, '#', 'so_company_id', 'Text', 0.00, 2.00, 'Left', false, false),
        ('01a1c515-a045-7719-ba26-1e3fe4f5ffa4', 201, 3, '#', 'so_branch_id', 'Text', 0.00, 3.00, 'Left', false, false),
        ('01a1c515-a045-771e-8156-a16db38a175b', 201, 4, '#', 'so_acc_year', 'Text', 0.00, 4.00, 'Left', false, false),
        ('01a1c515-a045-7722-9897-e36765fa05b3', 201, 5, 'Ord #', 'so_order_refno', 'Text', 7.73, 5.00, 'Left', true, true),
        ('01a1c515-a045-7726-9692-7b0b630cb48c', 201, 6, 'Date', 'so_order_date', 'Date', 7.22, 6.00, 'Left', true, false),
        ('01a1c515-a045-772a-95bc-48372e155f4f', 201, 7, '#', 'so_cust_id', 'Text', 0.00, 7.00, 'Left', false, false),
        ('01a1c515-a045-772e-8d5a-0b30352d6562', 201, 8, 'Customer', 'cus_name', 'Text', 14.95, 8.00, 'Left', true, true),
        ('01a1c515-a045-7732-a23e-33ea7ca585c3', 201, 9, 'Place', 'cus_place', 'Text', 9.11, 9.00, 'Left', true, true),
        ('01a1c515-a045-7736-9864-b7c00359d21f', 201, 10, 'Mobile', 'cus_phone', 'Text', 0.00, 10.00, 'Left', false, true),
        ('01a1c515-a045-773a-8c1d-cb57c3fc57cb', 201, 11, '#', 'arm_id', 'Text', 0.00, 11.00, 'Left', false, false),
        ('01a1c515-a045-773f-80ff-9b4612925f81', 201, 12, 'Beat', 'arm_name', 'Text', 0.00, 12.00, 'Left', false, false),
        ('01a1c515-a045-7743-83e7-a4aee92ff890', 201, 13, '#', 'ctm_id', 'Text', 0.00, 13.00, 'Left', false, false),
        ('01a1c515-a045-7747-9427-13e17626a602', 201, 14, 'City', 'ctm_name', 'Text', 0.00, 14.00, 'Left', false, false),
        ('01a1c515-a045-774b-a6f0-ff83f0226cf4', 201, 15, 'Status', 'desk_status', 'Text', 10.31, 15.00, 'Left', true, false),
        ('01a1c515-a045-774f-8e35-e2dca4aa95db', 201, 16, 'is_part_billed', 'is_part_billed', 'Boolean', 0.00, 16.00, 'Left', false, false),
        ('01a1c515-a045-7753-83f1-b722e6eb3882', 201, 17, 'so_status', 'so_status', 'Text', 0.00, 17.00, 'Left', false, false),
        ('01a1c515-a045-7757-be3d-d4d5fb2459b3', 201, 18, 'so_priority', 'so_priority', 'Text', 0.00, 18.00, 'Left', false, false),
        ('01a1c515-a045-775b-b7ed-d3dea6bb7398', 201, 19, 'is_quick', 'is_quick', 'Boolean', 0.00, 19.00, 'Left', false, false),
        ('01a1c515-a045-775f-a588-422c3b27e7e6', 201, 20, 'so_delivery_hold', 'so_delivery_hold', 'Boolean', 0.00, 20.00, 'Left', false, false),
        ('01a1c515-a045-7763-b66c-136d5d0d8f92', 201, 21, 'so_delivery_hold_reason', 'so_delivery_hold_reason', 'Text', 0.00, 21.00, 'Left', false, false),
        ('01a1c515-a045-7767-ade0-c2d6575c54fb', 201, 22, 'hold_by_name', 'hold_by_name', 'Text', 0.00, 22.00, 'Left', false, false),
        ('01a1c515-a045-776b-8ac6-47226c20763d', 201, 23, 'hold_on', 'hold_on', 'Text', 0.00, 23.00, 'Left', false, false),
        ('01a1c515-a045-776f-a520-e01c1f1b8e24', 201, 24, 'Items', 'open_items', 'Number', 4.47, 24.00, 'Right', true, false),
        ('01a1c515-a045-7774-b33d-1d5bd0f1af43', 201, 25, 'Bags', 'open_qty', 'Number', 4.47, 25.00, 'Right', true, false),
        ('01a1c515-a045-7778-b1b5-842912e1b40a', 201, 26, 'Wt kg', 'open_kg', 'Number', 6.01, 26.00, 'Right', true, false),
        ('01a1c515-a045-777c-93e8-56c46fc369f2', 201, 27, 'rate_changed', 'rate_changed', 'Boolean', 0.00, 27.00, 'Left', false, false),
        ('01a1c515-a045-7780-a71d-7c8444fa7b8e', 201, 28, 'Packing', 'packing', 'Text', 6.70, 28.00, 'Left', true, false),
        ('01a1c515-a045-7784-ab62-76c6a69f1940', 201, 29, 'Prt', 'so_print_count', 'Number', 3.44, 29.00, 'Right', true, false),
        ('01a1c515-a045-7788-8de4-5f5be318f2f1', 201, 30, 'cust_open_orders', 'cust_open_orders', 'Number', 0.00, 30.00, 'Right', false, false),
        ('01a1c515-a045-778c-bc5e-98e08275c00c', 201, 31, 'cus_open_bills', 'cus_open_bills', 'Number', 0.00, 31.00, 'Right', false, false),
        ('01a1c515-a045-7791-8560-7c0ea6742402', 201, 32, 'cus_overdue_bills', 'cus_overdue_bills', 'Number', 0.00, 32.00, 'Right', false, false),
        ('01a1c515-a045-7795-be2f-f04fb4bbadc9', 201, 33, 'Days', 'cus_oldest_days', 'Number', 4.12, 33.00, 'Right', true, false),
        ('01a1c515-a045-7799-8a09-8d35a0ed3036', 201, 34, 'has_credit_limit', 'has_credit_limit', 'Boolean', 0.00, 34.00, 'Left', false, false),
        ('01a1c515-a045-779d-b92b-25156050e4d1', 201, 35, 'cus_credit_bill_limit', 'cus_credit_bill_limit', 'Number', 0.00, 35.00, 'Right', false, false),
        ('01a1c515-a045-77a1-bb1c-a803202563cd', 201, 36, 'cus_credit_days', 'cus_credit_days', 'Number', 0.00, 36.00, 'Right', false, false),
        ('01a1c515-a045-77a5-9f46-9afef7cd3d50', 201, 37, 'is_credit_limit', 'is_credit_limit', 'Boolean', 0.00, 37.00, 'Left', false, false),
        ('01a1c515-a045-77a9-a66f-3a54d33c6eed', 201, 38, 'is_bill_limit', 'is_bill_limit', 'Boolean', 0.00, 38.00, 'Left', false, false),
        ('01a1c515-a045-77ad-923d-4b62e78e9853', 201, 39, 'is_days_over', 'is_days_over', 'Boolean', 0.00, 39.00, 'Left', false, false),
        ('01a1c515-a045-77b2-9bfb-2a850f3b3f03', 201, 40, '#', 'desk_rank', 'Number', 0.00, 40.00, 'Right', false, false),
        ('01a1c515-a045-77b6-bc41-e250a872671c', 202, 1, '#', 'ctm_id', 'Text', 0.00, 1.00, 'Left', false, false),
        ('01a1c515-a045-77ba-a908-3a1a6b4ed951', 202, 2, 'City', 'ctm_name', 'Text', 30.00, 2.00, 'Left', true, false),
        ('01a1c515-a045-77be-8753-8e857eb079e8', 202, 3, 'City order', 'ctm_order', 'Number', 0.00, 3.00, 'Right', false, false),
        ('01a1c515-a045-77c2-9b19-d97fe30174f1', 202, 4, '#', 'arm_id', 'Text', 0.00, 4.00, 'Left', false, false),
        ('01a1c515-a045-77c6-b3af-92b6392c7250', 202, 5, 'Beat', 'arm_name', 'Text', 40.00, 5.00, 'Left', true, false),
        ('01a1c515-a045-77ca-b19e-75fdee3d9ce9', 202, 6, 'Beat order', 'arm_sort', 'Number', 0.00, 6.00, 'Right', false, false),
        ('01a1c515-a045-77ce-89dd-25a993ad3486', 202, 7, 'Orders', 'so_count', 'Number', 15.00, 7.00, 'Right', true, false),
        ('01a1c515-a045-77d2-81ed-434ec0ea418e', 202, 8, 'Kg', 'so_kg', 'Number', 0.00, 8.00, 'Right', false, false),
        ('01a1c515-a045-77d7-97f8-c89865b0d3b3', 202, 9, 'Ton', 'so_ton', 'Number', 15.00, 9.00, 'Right', true, false),
        ('01a1c515-a045-77db-b281-171ab2cb2bec', 202, 10, 'All orders', 'all_count', 'Number', 0.00, 10.00, 'Right', false, false),
        ('01a1c515-a045-77df-b734-a307d99592a0', 202, 11, 'Quick', 'quick_count', 'Number', 0.00, 11.00, 'Right', false, false),
        ('01a1c515-a045-77e3-8c4b-b0f670bf7da5', 202, 12, 'Part-billed', 'partial_count', 'Number', 0.00, 12.00, 'Right', false, false),
        ('01a1c515-a045-77e7-a945-55d3e38e5c0c', 202, 13, 'Delivery hold', 'hold_count', 'Number', 0.00, 13.00, 'Right', false, false),
        ('01a1c515-a045-77eb-b749-020ae7b879c8', 202, 14, 'Duplicates', 'dup_cust_count', 'Number', 0.00, 14.00, 'Right', false, false),
        ('01a1c515-a045-77ef-9867-890b57f024c3', 202, 15, '#', 'beat_rank', 'Number', 0.00, 15.00, 'Right', false, false),
        ('01a1c515-a045-77f3-957a-10921048025e', 203, 1, '#', 'cus_id', 'Text', 0.00, 1.00, 'Left', false, false),
        ('01a1c515-a045-77f7-a76d-584603b44b42', 203, 2, 'Code', 'cus_code', 'Text', 8.00, 2.00, 'Left', true, true),
        ('01a1c515-a045-77fb-9638-0481b207288e', 203, 3, 'Customer', 'cus_name', 'Text', 26.00, 3.00, 'Left', true, true),
        ('01a1c515-a045-77ff-9775-779c4ada1e0c', 203, 4, 'Place', 'cus_place', 'Text', 14.00, 4.00, 'Left', true, true),
        ('01a1c515-a045-7804-b1fe-21846d37dc79', 203, 5, 'Mobile', 'cus_phone1', 'Text', 11.00, 5.00, 'Left', true, true),
        ('01a1c515-a045-7808-bd86-398a7daaff2a', 203, 6, '#', 'arm_id', 'Text', 0.00, 6.00, 'Left', false, false),
        ('01a1c515-a045-780c-b345-91b6fce1a5a4', 203, 7, 'Beat', 'arm_name', 'Text', 12.00, 7.00, 'Left', true, false),
        ('01a1c515-a045-7810-ad73-0d9875d6c301', 203, 8, 'City', 'ctm_name', 'Text', 0.00, 8.00, 'Left', false, false),
        ('01a1c515-a045-7814-8cd8-b1effc75a32a', 203, 9, 'Last bill', 'cus_billed_date', 'Date', 9.00, 9.00, 'Left', true, false),
        ('01a1c515-a045-7818-a047-d9730b707b15', 203, 10, 'Last order', 'last_order_date', 'Date', 9.00, 10.00, 'Left', true, false),
        ('01a1c515-a045-781c-9152-ac44272025cf', 203, 11, 'Days', 'days_since_order', 'Number', 5.00, 11.00, 'Right', true, false),
        ('01a1c515-a045-7820-9151-7b2f1cee2304', 203, 12, '#', 'cus_rank', 'Number', 0.00, 12.00, 'Right', false, false)
       ) v(id, grid, no, name, fld, typ, width, pos, align, visible, filter)
  JOIN fixed.grid_details d ON d.grid_id = v.grid
 WHERE d.grid_name = CASE v.grid WHEN 201 THEN 'MAIN LIST - SALE ORDER DESK'
                                 WHEN 202 THEN 'SALE ORDER DESK - BEATS'
                                 WHEN 203 THEN 'SALE ORDER DESK - NOT ORDERED' END
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns e
                    WHERE e.grid_id = v.grid AND e.grid_column_is_deleted = false
                      AND (e.grid_column_sql_field_name = v.fld OR e.grid_column_number = v.no))
ON CONFLICT (grid_column_id) DO NOTHING;

SELECT setval('fixed.grid_details_grid_id_seq',
              GREATEST((SELECT last_value FROM fixed.grid_details_grid_id_seq),
                       (SELECT COALESCE(MAX(grid_id), 1) FROM fixed.grid_details)), true);


-- ── 4 · grid 87: pending only leaves delivery-hold orders out (D35) ───────
DO $g87$
DECLARE
    v_name text;
    v_sql  text;
    v_hits int;
    v_old  constant text := 'AND (lower(NULLIF(''ipending_only'', '''')) IS DISTINCT FROM ''true'' OR (b.so_status IN (''CONFIRMED'', ''PARTIAL'') AND b.so_fulfil_status IN (''PENDING'', ''PARTIAL'')))';
    v_new  constant text := 'AND (lower(NULLIF(''ipending_only'', '''')) IS DISTINCT FROM ''true'' OR (b.so_status IN (''CONFIRMED'', ''PARTIAL'') AND b.so_fulfil_status IN (''PENDING'', ''PARTIAL'') AND b.so_delivery_hold = false))';
BEGIN
    SELECT grid_name, grid_sql INTO v_name, v_sql FROM fixed.grid_details WHERE grid_id = 87;
    IF NOT FOUND THEN
        RAISE NOTICE 'grid 87 is not there (fresh database): Grid_Details.sql seeds it with the delivery-hold clause.';
        RETURN;
    END IF;
    IF v_name IS DISTINCT FROM 'TXN MAIN LIST - SALES ORDER' THEN
        RAISE EXCEPTION 'grid 87 is "%", not TXN MAIN LIST - SALES ORDER. Stopped: check it by hand.', v_name;
    END IF;
    IF strpos(v_sql, v_new) > 0 THEN
        RETURN;
    END IF;
    IF v_sql ~* 'so_delivery_hold' THEN
        RAISE EXCEPTION 'grid 87 already names so_delivery_hold, but not in the expected clause. Stopped: check it by hand.';
    END IF;
    v_hits := (length(v_sql) - length(replace(v_sql, v_old, ''))) / length(v_old);
    IF v_hits <> 1 THEN
        RAISE EXCEPTION 'grid 87: the ipending_only clause of 20261110150000 was found % times, not once (md5 %). Stopped: re-read the live SQL.', v_hits, md5(v_sql);
    END IF;
    UPDATE fixed.grid_details
       SET grid_sql         = replace(grid_sql, v_old, v_new),
           grid_modified_by = 'system',
           grid_modified_on = now()
     WHERE grid_id = 87;
END $g87$;


-- ── 5 · ui_table 70 and its columns ────────────────────────────────────────
INSERT INTO fixed.ui_tables
       (ui_tbl_id, ui_tbl_name, ui_tbl_editable, ui_tbl_device_type, ui_tbl_is_active, ui_tbl_is_deleted, ui_tbl_created_by)
VALUES (70, 'SALE ORDER DESK - LIST', false, 'Desktop', true, false, 'system')
ON CONFLICT (ui_tbl_id) DO NOTHING;

INSERT INTO fixed.ui_table_columns
       (ui_tbl_clm_id, ui_tbl_clm_table_id, ui_tbl_clm_no, ui_tbl_clm_name, ui_tbl_clm_column_width,
        ui_tbl_clm_column_visibility, ui_tbl_clm_column_focus, ui_tbl_clm_column_position,
        ui_tbl_clm_column_necessity, ui_tbl_clm_is_active, ui_tbl_clm_is_deleted, ui_tbl_clm_created_by)
SELECT v.id, v.tbl, v.no, v.name, v.width, v.visible, v.focus, v.pos, false, true, false, 'system'
  FROM (VALUES
        (2429::bigint, 70::bigint, 0::bigint, '✓'::text, 2.58::numeric, true::boolean, false::boolean, 0::integer),
        (2430, 70, 1, 'Ord #', 7.73, true, false, 1),
        (2431, 70, 2, 'Status', 10.31, true, false, 2),
        (2432, 70, 3, 'Date', 7.22, true, false, 3),
        (2433, 70, 4, 'Customer', 11.95, true, false, 4),
        (2434, 70, 5, 'Place', 7.11, true, false, 5),
        (2435, 70, 6, 'Items', 4.47, true, false, 6),
        (2436, 70, 7, 'Bags', 4.47, true, false, 7),
        (2437, 70, 8, 'Wt kg', 6.01, true, false, 8),
        (2438, 70, 9, 'Value', 8.93, true, false, 9),
        (2439, 70, 10, 'Packing', 6.70, true, false, 10),
        (2440, 70, 11, 'Prt', 3.44, true, false, 11),
        (2441, 70, 12, 'Days', 4.12, true, false, 12),
        (2442, 70, 13, 'Log', 9.96, true, false, 13),
        (2443, 70, 14, 'SoId', 0.00, false, false, 14),
        (2444, 70, 15, 'CompanyId', 0.00, false, false, 15),
        (2445, 70, 16, 'BranchId', 0.00, false, false, 16),
        (2446, 70, 17, 'AccYear', 0.00, false, false, 17),
        (2447, 70, 18, 'CustId', 0.00, false, false, 18),
        (2448, 70, 19, 'AreaId', 0.00, false, false, 19),
        (2449, 70, 20, 'AreaName', 0.00, false, false, 20),
        (2450, 70, 21, 'CityId', 0.00, false, false, 21),
        (2451, 70, 22, 'CityName', 0.00, false, false, 22),
        (2452, 70, 23, 'CustPhone', 0.00, false, false, 23),
        (2453, 70, 24, 'SoStatus', 0.00, false, false, 24),
        (2454, 70, 25, 'Priority', 0.00, false, false, 25),
        (2455, 70, 26, 'IsQuick', 0.00, false, false, 26),
        (2456, 70, 27, 'IsPartBilled', 0.00, false, false, 27),
        (2457, 70, 28, 'DeliveryHold', 0.00, false, false, 28),
        (2458, 70, 29, 'HoldReason', 0.00, false, false, 29),
        (2459, 70, 30, 'HoldByName', 0.00, false, false, 30),
        (2460, 70, 31, 'HoldOn', 0.00, false, false, 31),
        (2461, 70, 32, 'RateChanged', 0.00, false, false, 32),
        (2462, 70, 33, 'OrderOpenValue', 0.00, false, false, 33),
        (2463, 70, 34, 'OrderAmt', 0.00, false, false, 34),
        (2464, 70, 35, 'CustOpenOrders', 0.00, false, false, 35),
        (2465, 70, 36, 'CusPending', 0.00, false, false, 36),
        (2466, 70, 37, 'CusOpenBills', 0.00, false, false, 37),
        (2467, 70, 38, 'CusOverdue', 0.00, false, false, 38),
        (2468, 70, 39, 'CusOverdueBills', 0.00, false, false, 39),
        (2469, 70, 40, 'CreditAmtLimit', 0.00, false, false, 40),
        (2470, 70, 41, 'CreditBillLimit', 0.00, false, false, 41),
        (2471, 70, 42, 'CreditDays', 0.00, false, false, 42),
        (2472, 70, 43, 'AvailCredit', 0.00, false, false, 43),
        (2473, 70, 44, 'IsCreditLimit', 0.00, false, false, 44),
        (2474, 70, 45, 'IsBillLimit', 0.00, false, false, 45),
        (2475, 70, 46, 'IsDaysOver', 0.00, false, false, 46),
        (2476, 70, 47, 'HasCreditLimit', 0.00, false, false, 47)
       ) v(id, tbl, no, name, width, visible, focus, pos)
 WHERE EXISTS (SELECT 1 FROM fixed.ui_tables t WHERE t.ui_tbl_id = v.tbl AND t.ui_tbl_name = 'SALE ORDER DESK - LIST')
   AND NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns e
                    WHERE e.ui_tbl_clm_table_id = v.tbl AND e.ui_tbl_clm_no = v.no AND e.ui_tbl_clm_is_deleted = false)
ON CONFLICT (ui_tbl_clm_id) DO NOTHING;

SELECT setval('fixed.ui_tables_ui_tbl_id_seq',
              GREATEST((SELECT last_value FROM fixed.ui_tables_ui_tbl_id_seq),
                       (SELECT COALESCE(MAX(ui_tbl_id), 1) FROM fixed.ui_tables)), true);
SELECT setval('fixed.ui_table_columns_ui_tbl_clm_id_seq',
              GREATEST((SELECT last_value FROM fixed.ui_table_columns_ui_tbl_clm_id_seq),
                       (SELECT COALESCE(MAX(ui_tbl_clm_id), 1) FROM fixed.ui_table_columns)), true);


-- ── 6 · plain wording rows (notes 120), catalogue 2026-11-10.1 ─────────────
INSERT INTO fixed.error_message
    (erm_code, erm_variant, erm_lang, erm_title, erm_line, erm_todo)
VALUES
     ('SALES_ORDER_DELIVERY_HOLD', '', 'en', 'On delivery hold', 'This order is on delivery hold.', 'Release it on Sales Order Management first.')
    ,('SALES_ORDER_HOLD_UNCHANGED', '', 'en', 'Already done', 'Someone already put this order on delivery hold, or released it.', 'Refresh the list to see it.')
    ,('SALES_ORDER_PRIORITY_UNCHANGED', '', 'en', 'Already done', 'This order is already marked that way.', 'Refresh the list to see it.')
    ,('SALES_ORDER_CLOSED', '', 'en', 'Order closed', 'Nothing is left open on this order.', 'Refresh the list.')
    ,('SALES_ORDER_REASON_REQUIRED', '', 'en', 'Reason needed', 'Say why.', 'Type the reason, then try again.')
    ,('SALES_ORDER_MERGE_TOO_FEW', '', 'en', 'Cannot merge', 'Merge needs 2 or more orders.', 'Tick 2 or more orders of one customer.')
    ,('SALES_ORDER_MERGE_ONE_PARTY', '', 'en', 'Cannot merge', 'These orders are for different customers.', 'Tick orders of one customer only.')
    ,('SALES_ORDER_MERGE_TERMS_DIFFER', '', 'en', 'Cannot merge', 'These orders differ in cash / credit, order type or place of supply.', 'Merge only orders with the same terms.')
    ,('SALES_ORDER_MERGE_ADVANCE', '', 'en', 'Cannot merge', 'One of these orders holds an advance payment.', 'Refund or move the advance first, or leave that order out.')
    ,('SALES_ORDER_MERGE_CHARGES', '', 'en', 'Cannot merge', 'One of these orders has charges on the whole order (freight, loading, other).', 'Remove them in the order first, or leave that order out.')
    ,('SALES_ORDER_MERGE_SOURCE_CHANGED', '', 'en', 'Changed meanwhile', 'An order changed while you merged it (a bill took some of it).', 'Close and merge again.')
    ,('SALES_ORDER_MONEY_RIGHT', '', 'en', 'Amounts hidden', 'You have no right to see amounts and dues here.', 'Call manager (Receipt view right).')
    ,('SALE_ORDER_ADVANCE_HELD', '', 'en', 'Advance held', 'This order still holds an advance payment.', 'Refund or move the advance first.')
ON CONFLICT (erm_code, erm_variant, erm_lang) DO NOTHING;

UPDATE fixed.error_message_catalogue
   SET emc_version   = '2026-11-10.1',
       emc_row_count = (SELECT count(*) FROM fixed.error_message WHERE erm_is_active),
       emc_loaded_on = now()
 WHERE emc_id = 1
   AND emc_version < '2026-11-10.1';
