-- Sales Order entry (menu 11) — grids 204 and 205, the same rows migration
-- 20261110200000_sales_order_entry_grids_widgets writes.
--
--   204 "POPUP - GODOWN STOCK (SALES)": the F12 popup, the line item's stock per godown
--       of the branch in the line's unit (On hand / On orders / Available).
--   205 "SO ENTRY - CUSTOMER PENDING LINES": the pending panel, the customer's open order
--       lines (DRAFT / CONFIRMED / PARTIAL, pending > 0), this branch, every year.
--
-- Plan: Shared/Prathap/sales/plan-sales-order-entry-changes-2026-11-10.md §4.
--
-- WHY A TARGETED SEED RATHER THAN AN EDIT TO Grid_Details.sql / Grid_Columns.sql
--   Those two are exports (npm run seed:export:ui-config), and Grid_Columns.sql
--   skips any grid that already has a column. This file adds just these two grids
--   to any database that lacks them (precedent:
--   Quotation_Item_Grid_ItemSize_Column.sql). It runs after both (manifest order).
--
-- The grid_sql text is byte-identical to the migration's and holds no comment
-- marker (the runner refuses one). grid_column ids are pinned (the migration's),
-- so every database ends up with the same rows.
--
-- 2026-11-11: grid 205's shown widths are 15 / 17 / 19 / 13 / 9 / 22
-- (Ord # / Date / Item / Pending / Unit / Status, sum 95), the values migration
-- 20261111140000_sales_order_entry_grid205_widths_2 moves an existing grid to
-- (after 20261111120000_sales_order_entry_grid205_widths shipped 16 / 17 / 23 /
-- 13 / 8 / 18).
--
-- Idempotent: ON CONFLICT (grid_id) DO NOTHING keeps a grid a site has edited;
-- a column goes in only under a grid of the expected name with no live column of
-- that field or number. Safe to re-run.
-- Run: psql "$DATABASE_URL" -f prisma/seed/Sale_Order_Entry_Grids_204_205.sql
--      or: npm run seed:run -- --only=Sale_Order_Entry_Grids_204_205.sql

BEGIN;

INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_sort_column, grid_sort_order, grid_device_type,
        grid_status, grid_is_deleted, grid_created_by, grid_sql)
VALUES (204, 'POPUP - GODOWN STOCK (SALES)',
        'Sales Order entry (menu 11) F12 popup: the line item''s stock in each godown of this branch, in the line''s unit (stock.stock_balance SALEABLE divided by iuc_to_base_factor): on hand, held for confirmed orders, available. Lists the godowns that hold the item plus the line''s current one. Page with sort_by=gd_rank. Tokens (send every one): icompany_id, ibranch_id, iitem_id, iitem_unit_id (the line''s iuc_id), icurrent_godown_id (the line''s godown, '''' = none).',
        'gd_rank', 'Ascending', 'Desktop', true, false, 'system', $seed$SELECT g.gdl_id, g.gdl_name,
       round(COALESCE(b.on_hand, 0) / NULLIF(u.iuc_to_base_factor, 0), 3) AS on_hand_qty,
       round(COALESCE(b.reserved, 0) / NULLIF(u.iuc_to_base_factor, 0), 3) AS reserved_qty,
       round(COALESCE(b.available, 0) / NULLIF(u.iuc_to_base_factor, 0), 3) AS available_qty,
       um.unit_name,
       CASE WHEN g.gdl_id = NULLIF('icurrent_godown_id', '')::uuid THEN 'NOW' ELSE '' END AS current_mark,
       row_number() OVER (ORDER BY (COALESCE(b.available, 0) > 0) DESC, g.gdl_sort, g.gdl_name) AS gd_rank
  FROM inventory.godown_locations g
  JOIN inventory.item_unit_conversion u ON u.iuc_id = 'iitem_unit_id'::uuid
  JOIN inventory.item_unit_master um ON um.unit_id = u.iuc_unit_id
  LEFT JOIN LATERAL (
        SELECT SUM(s.sbl_on_hand_qty) AS on_hand, SUM(s.sbl_reserved_qty) AS reserved,
               SUM(s.sbl_available_qty) AS available
          FROM stock.stock_balance s
         WHERE s.sbl_company_id = 'icompany_id'::uuid
           AND s.sbl_branch_id = 'ibranch_id'::uuid
           AND s.sbl_godown_id = g.gdl_id
           AND s.sbl_item_id = 'iitem_id'::uuid
           AND s.sbl_bucket = 'SALEABLE'
           AND s.sbl_is_deleted = false AND s.sbl_is_active = true
       ) b ON true
 WHERE g.gdl_branch_id = 'ibranch_id'::uuid
   AND g.gdl_is_active = true AND g.gdl_is_deleted = false
   AND (COALESCE(b.on_hand, 0) <> 0 OR g.gdl_id = NULLIF('icurrent_godown_id', '')::uuid)$seed$)
ON CONFLICT (grid_id) DO NOTHING;

INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_sort_column, grid_sort_order, grid_device_type,
        grid_status, grid_is_deleted, grid_created_by, grid_sql)
VALUES (205, 'SO ENTRY - CUSTOMER PENDING LINES',
        'Sales Order entry (menu 11) pending panel: one row per open line (soi_pending_qty > 0) of the customer''s DRAFT / CONFIRMED / PARTIAL orders in this company and branch, every year unless iacc_year is set, leaving out iexclude_so_id (the order on screen). No amounts. Page with sort_by=pend_rank. Tokens (send every one; '''' = off): icompany_id, ibranch_id, icust_id ('''' = no rows), iacc_year, iexclude_so_id.',
        'pend_rank', 'Ascending', 'Desktop', true, false, 'system', $seed$SELECT so.so_id, so.so_company_id, so.so_branch_id, so.so_acc_year,
       so.so_order_refno, so.so_order_date,
       d.soi_id, d.soi_item_id, d.soi_item_unit_id,
       i.item_name_en AS item_name,
       round(d.soi_pending_qty, 3) AS pending_qty, um.unit_name,
       CASE WHEN so.so_delivery_hold THEN 'DELIVERY HOLD'
            WHEN so.so_status = 'PARTIAL' THEN 'PART-BILLED'
            ELSE so.so_status END AS order_state,
       so.so_delivery_date,
       row_number() OVER (ORDER BY so.so_order_date DESC, so.so_order_refno DESC, d.soi_line_no) AS pend_rank
  FROM sales.sale_order so
  JOIN sales.sale_order_item d ON d.soi_order_id = so.so_id AND d.soi_acc_year = so.so_acc_year
                              AND d.soi_is_deleted = false
  JOIN inventory.item_master i ON i.item_id = d.soi_item_id
  JOIN inventory.item_unit_conversion u ON u.iuc_id = d.soi_item_unit_id
  JOIN inventory.item_unit_master um ON um.unit_id = u.iuc_unit_id
 WHERE so.so_company_id = 'icompany_id'::uuid
   AND so.so_branch_id = 'ibranch_id'::uuid
   AND so.so_cust_id = NULLIF('icust_id', '')::uuid
   AND so.so_is_deleted = false
   AND so.so_status IN ('DRAFT', 'CONFIRMED', 'PARTIAL')
   AND d.soi_pending_qty > 0
   AND ('iacc_year' = '' OR so.so_acc_year = 'iacc_year')
   AND ('iexclude_so_id' = '' OR so.so_id <> NULLIF('iexclude_so_id', '')::uuid)$seed$)
ON CONFLICT (grid_id) DO NOTHING;

INSERT INTO fixed.grid_columns
       (grid_column_id, grid_id, grid_column_number, grid_column_name, grid_column_sql_field_name,
        grid_column_data_type, grid_column_width, grid_column_position, grid_column_alignment,
        grid_column_visibility, grid_column_filter, grid_column_group, grid_column_total,
        grid_column_is_deleted, grid_column_created_by)
SELECT v.id, v.grid, v.no, v.name, v.fld, v.typ, v.width, v.pos, v.align, v.visible, v.filter, false, false, false, 'system'
  FROM (VALUES
        ('01a1c5e6-bfb2-7946-ad5c-30c64f7cfa8c'::uuid, 204::bigint, 1::integer, '#'::text, 'gdl_id'::text, 'Text'::text, 0.00::numeric, 1.00::numeric, 'Left'::text, false::boolean, false::boolean),
        ('01a1c5e6-bfb2-7976-b53c-a276cdd5407c', 204, 2, 'Godown', 'gdl_name', 'Text', 38.00, 2.00, 'Left', true, true),
        ('01a1c5e6-bfb2-7980-a7fc-96f0eb7d90cb', 204, 3, 'On hand', 'on_hand_qty', 'Number', 17.00, 3.00, 'Right', true, false),
        ('01a1c5e6-bfb2-7988-87cd-012ed6723b97', 204, 4, 'On orders', 'reserved_qty', 'Number', 17.00, 4.00, 'Right', true, false),
        ('01a1c5e6-bfb2-798f-a81b-46223a5a4d74', 204, 5, 'Available', 'available_qty', 'Number', 17.00, 5.00, 'Right', true, false),
        ('01a1c5e6-bfb2-7997-ad33-a7cbdc9a41be', 204, 6, 'Unit', 'unit_name', 'Text', 0.00, 6.00, 'Left', false, false),
        ('01a1c5e6-bfb2-799e-99d7-eac461716b45', 204, 7, 'Now', 'current_mark', 'Text', 6.00, 7.00, 'Center', true, false),
        ('01a1c5e6-bfb2-79a6-8c74-705899373ede', 204, 8, '#', 'gd_rank', 'Number', 0.00, 8.00, 'Right', false, false),
        ('01a1c5e6-bfb2-79ad-9218-7a25899d4321', 205, 1, '#', 'so_id', 'Text', 0.00, 1.00, 'Left', false, false),
        ('01a1c5e6-bfb2-79b4-aa86-4e7021463285', 205, 2, '#', 'so_company_id', 'Text', 0.00, 2.00, 'Left', false, false),
        ('01a1c5e6-bfb2-79bc-8ce0-852313d0ecd3', 205, 3, '#', 'so_branch_id', 'Text', 0.00, 3.00, 'Left', false, false),
        ('01a1c5e6-bfb2-79c5-ae41-55858522ec40', 205, 4, '#', 'so_acc_year', 'Text', 0.00, 4.00, 'Left', false, false),
        ('01a1c5e6-bfb2-79cc-8e04-8980bf11d8a9', 205, 5, 'Ord #', 'so_order_refno', 'Text', 15.00, 5.00, 'Left', true, true),
        ('01a1c5e6-bfb2-79d3-af5f-4e784ff49e60', 205, 6, 'Date', 'so_order_date', 'Date', 17.00, 6.00, 'Left', true, false),
        ('01a1c5e6-bfb2-79db-8cd7-cc133ae09179', 205, 7, '#', 'soi_id', 'Text', 0.00, 7.00, 'Left', false, false),
        ('01a1c5e6-bfb2-79e3-be1b-df0c295ecc23', 205, 8, '#', 'soi_item_id', 'Text', 0.00, 8.00, 'Left', false, false),
        ('01a1c5e6-bfb2-79ea-9f0d-3f9f54ca896a', 205, 9, '#', 'soi_item_unit_id', 'Text', 0.00, 9.00, 'Left', false, false),
        ('01a1c5e6-bfb2-79f1-b62b-533d00e10c8f', 205, 10, 'Item', 'item_name', 'Text', 19.00, 10.00, 'Left', true, true),
        ('01a1c5e6-bfb2-79f9-9575-5211907c0a45', 205, 11, 'Pending', 'pending_qty', 'Number', 13.00, 11.00, 'Right', true, false),
        ('01a1c5e6-bfb2-7a00-bdc5-9e3aaacbf142', 205, 12, 'Unit', 'unit_name', 'Text', 9.00, 12.00, 'Left', true, false),
        ('01a1c5e6-bfb2-7a07-9c2c-3e414008c68f', 205, 13, 'Status', 'order_state', 'Text', 22.00, 13.00, 'Left', true, false),
        ('01a1c5e6-bfb2-7a0f-ad50-0fd84d5b0d44', 205, 14, 'Delivery', 'so_delivery_date', 'Date', 0.00, 14.00, 'Left', false, false),
        ('01a1c5e6-bfb2-7a16-9697-c7fdfa19e10f', 205, 15, '#', 'pend_rank', 'Number', 0.00, 15.00, 'Right', false, false)
       ) v(id, grid, no, name, fld, typ, width, pos, align, visible, filter)
  JOIN fixed.grid_details d ON d.grid_id = v.grid
 WHERE d.grid_name = CASE v.grid WHEN 204 THEN 'POPUP - GODOWN STOCK (SALES)'
                                 WHEN 205 THEN 'SO ENTRY - CUSTOMER PENDING LINES' END
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns e
                    WHERE e.grid_id = v.grid AND e.grid_column_is_deleted = false
                      AND (e.grid_column_sql_field_name = v.fld OR e.grid_column_number = v.no))
ON CONFLICT (grid_column_id) DO NOTHING;

SELECT setval('fixed.grid_details_grid_id_seq',
              GREATEST((SELECT last_value FROM fixed.grid_details_grid_id_seq),
                       (SELECT COALESCE(MAX(grid_id), 1) FROM fixed.grid_details)), true);

COMMIT;
