-- ═══════════════════════════════════════════════════════════════════════════
--  Sales Order entry (Qt, menu 11): the DB side of the 2026-11-10 change list
--  Plan: Shared/Prathap/sales/plan-sales-order-entry-changes-2026-11-10.md §4
--  and its Answers ("go recommended", 2026-11-10 ~20:15); mockup
--  sales_order_entry_changes_ui_mockup.png. Config rows only: no table, column,
--  index, CHECK, function or trigger, so db_table_master and
--  ensure_acc_year_partitions are not touched. Sorts after
--  20261110190000_app_theme_template_v61.
--
--  1 · grid 204 "POPUP - GODOWN STOCK (SALES)" (item 9, E9a, the F12 popup). Per
--      godown of the branch that holds the item (plus the line's current one): On hand,
--      On orders (sbl_reserved_qty, held for CONFIRMED orders) and Available,
--      SALEABLE bucket, in the LINE's unit (base qty / iuc_to_base_factor).
--      Tokens: icompany_id ibranch_id iitem_id iitem_unit_id (always real uuids,
--      cast) and icurrent_godown_id ('' = none, NULLIF(...)::uuid). sort_by=gd_rank.
--
--  2 · grid 205 "SO ENTRY - CUSTOMER PENDING LINES" (item 10, E10a, the pending
--      panel). One row per open line of the customer's orders in this company +
--      branch, every year (Answer 13): status DRAFT (Answer 11) / CONFIRMED /
--      PARTIAL, soi_pending_qty > 0, not deleted, minus iexclude_so_id (the
--      order on screen). Status text CONFIRMED / PART-BILLED / DELIVERY HOLD /
--      DRAFT. No money column (desk D34). Tokens: icompany_id ibranch_id (cast),
--      icust_id ('' = no rows; NULLIF cast keeps ix_so_cust usable), iacc_year
--      ('' = every year, text), iexclude_so_id ('' = none). sort_by=pend_rank.
--      Every caller sends every token; a left-out uuid token is a 400
--      GRID_RUN_PARAM_MISSING. No comments in either grid_sql. grid_columns
--      ids are pinned uuidv7s after the live max (grid 203's, 16:21 today), so
--      the seed below and this file make the same rows everywhere.
--
--  3 · widget show / hide (item 6, E6): menu 11, platform Desktop, 6 sections
--      (customer, order_info, delivery, credit, pending_orders, margin) and 27
--      fields. field_name = the save payload's key (the .ui fieldKey); beat /
--      margin / savings are screen-only keys. Everything ships visible with the
--      on-screen label as field_gui_name, so the screen looks the same until
--      someone hides something. soCustId / soOrderDate / soRemarks (and a
--      mandatory salesman) are never hidden: the .ui marks them
--      fieldRequired (Answer 7); that is not a DB property.
--      Matched by NAME (menu 11 + Desktop + section_name; a field by name
--      anywhere under menu 11 Desktop), ids from the sequences: dev gives
--      sections 95-100 and fields 872-898, another database its own. A site's
--      own hides and labels are never changed. Needs menu 11: on a fresh
--      database (menus are seeded after migrations) this part does nothing and
--      the seed adds the rows.
--
--  Same rows in prisma/seed/Sale_Order_Entry_Grids_204_205.sql and
--  prisma/seed/Sale_Order_Widget_Config_Menu11_Desktop.sql (seed.manifest.json
--  lists both). Grid_Details.sql / Grid_Columns.sql are NOT edited.
--  Grid 204 / 205 or a pinned column id already taken by something else stops
--  the migration. Re-running the file changes nothing.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 0 · pinned ids must be free (or already ours) ──────────────────────────
DO $chk$
DECLARE
    v_clash text;
BEGIN
    SELECT string_agg(x, '; ') INTO v_clash FROM (
        SELECT format('grid %s (%s)', d.grid_id, d.grid_name) AS x
          FROM fixed.grid_details d
          JOIN (VALUES (204::bigint, 'POPUP - GODOWN STOCK (SALES)'::text),
                       (205, 'SO ENTRY - CUSTOMER PENDING LINES')) v(id, name) ON v.id = d.grid_id
         WHERE d.grid_name IS DISTINCT FROM v.name
        UNION ALL
        SELECT format('grid_column %s (grid %s no %s)', c.grid_column_id, c.grid_id, c.grid_column_number)
          FROM fixed.grid_columns c
          JOIN (VALUES
                ('01a1c5e6-bfb2-7946-ad5c-30c64f7cfa8c'::uuid, 204::bigint, 1::integer),
                ('01a1c5e6-bfb2-7976-b53c-a276cdd5407c', 204, 2),
                ('01a1c5e6-bfb2-7980-a7fc-96f0eb7d90cb', 204, 3),
                ('01a1c5e6-bfb2-7988-87cd-012ed6723b97', 204, 4),
                ('01a1c5e6-bfb2-798f-a81b-46223a5a4d74', 204, 5),
                ('01a1c5e6-bfb2-7997-ad33-a7cbdc9a41be', 204, 6),
                ('01a1c5e6-bfb2-799e-99d7-eac461716b45', 204, 7),
                ('01a1c5e6-bfb2-79a6-8c74-705899373ede', 204, 8),
                ('01a1c5e6-bfb2-79ad-9218-7a25899d4321', 205, 1),
                ('01a1c5e6-bfb2-79b4-aa86-4e7021463285', 205, 2),
                ('01a1c5e6-bfb2-79bc-8ce0-852313d0ecd3', 205, 3),
                ('01a1c5e6-bfb2-79c5-ae41-55858522ec40', 205, 4),
                ('01a1c5e6-bfb2-79cc-8e04-8980bf11d8a9', 205, 5),
                ('01a1c5e6-bfb2-79d3-af5f-4e784ff49e60', 205, 6),
                ('01a1c5e6-bfb2-79db-8cd7-cc133ae09179', 205, 7),
                ('01a1c5e6-bfb2-79e3-be1b-df0c295ecc23', 205, 8),
                ('01a1c5e6-bfb2-79ea-9f0d-3f9f54ca896a', 205, 9),
                ('01a1c5e6-bfb2-79f1-b62b-533d00e10c8f', 205, 10),
                ('01a1c5e6-bfb2-79f9-9575-5211907c0a45', 205, 11),
                ('01a1c5e6-bfb2-7a00-bdc5-9e3aaacbf142', 205, 12),
                ('01a1c5e6-bfb2-7a07-9c2c-3e414008c68f', 205, 13),
                ('01a1c5e6-bfb2-7a0f-ad50-0fd84d5b0d44', 205, 14),
                ('01a1c5e6-bfb2-7a16-9697-c7fdfa19e10f', 205, 15)
               ) v(id, grid, no) ON v.id = c.grid_column_id
         WHERE (c.grid_id, c.grid_column_number) IS DISTINCT FROM (v.grid, v.no)
    ) clash;
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Sales Order entry migration: pinned ids already used by something else: %', v_clash;
    END IF;
END
$chk$;


-- ── 1 + 2 · grids 204 / 205 and their columns ─────────────────────────────
INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_sort_column, grid_sort_order, grid_device_type,
        grid_status, grid_is_deleted, grid_created_by, grid_sql)
VALUES (204, 'POPUP - GODOWN STOCK (SALES)',
        'Sales Order entry (menu 11) F12 popup: the line item''s stock in each godown of this branch, in the line''s unit (stock.stock_balance SALEABLE divided by iuc_to_base_factor): on hand, held for confirmed orders, available. Lists the godowns that hold the item plus the line''s current one. Page with sort_by=gd_rank. Tokens (send every one): icompany_id, ibranch_id, iitem_id, iitem_unit_id (the line''s iuc_id), icurrent_godown_id (the line''s godown, '''' = none).',
        'gd_rank', 'Ascending', 'Desktop', true, false, 'system', $mig$SELECT g.gdl_id, g.gdl_name,
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
   AND (COALESCE(b.on_hand, 0) <> 0 OR g.gdl_id = NULLIF('icurrent_godown_id', '')::uuid)$mig$)
ON CONFLICT (grid_id) DO NOTHING;

INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_sort_column, grid_sort_order, grid_device_type,
        grid_status, grid_is_deleted, grid_created_by, grid_sql)
VALUES (205, 'SO ENTRY - CUSTOMER PENDING LINES',
        'Sales Order entry (menu 11) pending panel: one row per open line (soi_pending_qty > 0) of the customer''s DRAFT / CONFIRMED / PARTIAL orders in this company and branch, every year unless iacc_year is set, leaving out iexclude_so_id (the order on screen). No amounts. Page with sort_by=pend_rank. Tokens (send every one; '''' = off): icompany_id, ibranch_id, icust_id ('''' = no rows), iacc_year, iexclude_so_id.',
        'pend_rank', 'Ascending', 'Desktop', true, false, 'system', $mig$SELECT so.so_id, so.so_company_id, so.so_branch_id, so.so_acc_year,
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
   AND ('iexclude_so_id' = '' OR so.so_id <> NULLIF('iexclude_so_id', '')::uuid)$mig$)
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
        ('01a1c5e6-bfb2-79d3-af5f-4e784ff49e60', 205, 6, 'Date', 'so_order_date', 'Date', 15.00, 6.00, 'Left', true, false),
        ('01a1c5e6-bfb2-79db-8cd7-cc133ae09179', 205, 7, '#', 'soi_id', 'Text', 0.00, 7.00, 'Left', false, false),
        ('01a1c5e6-bfb2-79e3-be1b-df0c295ecc23', 205, 8, '#', 'soi_item_id', 'Text', 0.00, 8.00, 'Left', false, false),
        ('01a1c5e6-bfb2-79ea-9f0d-3f9f54ca896a', 205, 9, '#', 'soi_item_unit_id', 'Text', 0.00, 9.00, 'Left', false, false),
        ('01a1c5e6-bfb2-79f1-b62b-533d00e10c8f', 205, 10, 'Item', 'item_name', 'Text', 31.00, 10.00, 'Left', true, true),
        ('01a1c5e6-bfb2-79f9-9575-5211907c0a45', 205, 11, 'Pending', 'pending_qty', 'Number', 11.00, 11.00, 'Right', true, false),
        ('01a1c5e6-bfb2-7a00-bdc5-9e3aaacbf142', 205, 12, 'Unit', 'unit_name', 'Text', 8.00, 12.00, 'Left', true, false),
        ('01a1c5e6-bfb2-7a07-9c2c-3e414008c68f', 205, 13, 'Status', 'order_state', 'Text', 15.00, 13.00, 'Left', true, false),
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


-- ── 3 · menu 11 Desktop widget rows (sections, then fields) ───────────────
--    The two setvals only ever move a sequence forward (never behind the table).
SELECT setval(pg_get_serial_sequence('fixed.form_section', 'section_id'), MAX(section_id))
  FROM fixed.form_section
HAVING MAX(section_id) > COALESCE(
           pg_sequence_last_value(pg_get_serial_sequence('fixed.form_section', 'section_id')::regclass), 0);

SELECT setval(pg_get_serial_sequence('fixed.form_field', 'field_id'), MAX(field_id))
  FROM fixed.form_field
HAVING MAX(field_id) > COALESCE(
           pg_sequence_last_value(pg_get_serial_sequence('fixed.form_field', 'field_id')::regclass), 0);

INSERT INTO fixed.form_section
       (section_menu_id, section_name, section_gui_name, section_position,
        section_visibility, section_platform, section_created_by)
SELECT 11, v.name, v.gui, v.pos, true, 'Desktop', 'migration 20261110200000'
  FROM (VALUES
               ('customer', 'Customer', 1),
               ('order_info', 'Order', 2),
               ('delivery', 'Delivery & options', 3),
               ('credit', 'Credit standing', 4),
               ('pending_orders', 'Pending orders', 5),
               ('margin', 'Margin line', 6)
       ) AS v(name, gui, pos)
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 11)
   AND NOT EXISTS (SELECT 1 FROM fixed.form_section s
                    WHERE s.section_menu_id = 11
                      AND s.section_platform = 'Desktop'
                      AND lower(btrim(s.section_name)) = v.name)
 ORDER BY v.pos;

WITH sec AS (
    SELECT DISTINCT ON (lower(btrim(section_name))) lower(btrim(section_name)) AS sname, section_id
      FROM fixed.form_section
     WHERE section_menu_id = 11
       AND section_platform = 'Desktop'
     ORDER BY lower(btrim(section_name)), section_id
)
INSERT INTO fixed.form_field
       (field_section_id, field_name, field_gui_name, field_position,
        field_visibility, field_created_by)
SELECT sec.section_id, v.fname, v.gui, v.pos, true, 'migration 20261110200000'
  FROM (VALUES
    ('customer', 'beat', 'Beat', 1),
    ('customer', 'soCustId', 'Customer', 2),
    ('customer', 'soCustName', 'Name', 3),
    ('customer', 'soCustPlace', 'Place', 4),
    ('customer', 'soCustPhone', 'Phone', 5),
    ('customer', 'soCustGstin', 'GSTIN', 6),
    ('customer', 'soPosStcd', 'POS State Code', 7),
    ('order_info', 'soOrderRefno', 'Order No', 1),
    ('order_info', 'soOrderDate', 'Order Date', 2),
    ('order_info', 'soOrderType', 'Term', 3),
    ('order_info', 'soPriceLevel', 'Price Level', 4),
    ('order_info', 'soDeliveryDate', 'Delivery Date', 5),
    ('order_info', 'soValidUntil', 'Valid Until', 6),
    ('order_info', 'soPriority', 'Priority', 7),
    ('delivery', 'soSalesmanId', 'Salesman', 1),
    ('delivery', 'soAgentId', 'Agent', 2),
    ('delivery', 'soPackedId', 'Packed By', 3),
    ('delivery', 'soHasFreight', 'Freight', 4),
    ('delivery', 'soHasLoad', 'Load', 5),
    ('delivery', 'soHasUnload', 'Unload', 6),
    ('delivery', 'soHasPromo', 'Promo', 7),
    ('delivery', 'soHasLoyalty', 'Loyalty', 8),
    ('delivery', 'soDeliveryMode', 'Delivery Mode', 9),
    ('delivery', 'soDeliverySlot', 'Slot', 10),
    ('delivery', 'soRemarks', 'Remarks', 11),
    ('margin', 'margin', 'Total Profit', 1),
    ('margin', 'savings', 'Total Saving', 2)
       ) AS v(sname, fname, gui, pos)
  JOIN sec ON sec.sname = v.sname
 WHERE NOT EXISTS (SELECT 1
                     FROM fixed.form_field f
                     JOIN fixed.form_section s ON s.section_id = f.field_section_id
                    WHERE s.section_menu_id = 11
                      AND s.section_platform = 'Desktop'
                      AND lower(btrim(f.field_name)) = lower(v.fname))
 ORDER BY sec.section_id, v.pos;
