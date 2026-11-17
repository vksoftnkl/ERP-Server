-- Delivery Challan + Challan Return P1 -- grids 219 to 221, the same rows migration
-- 20261118100000_dc_dc_return writes (plan Shared/Prathap/sales/plan-dc-dc-return-2026-11-16.md
-- §7.4).
--
--   219 "MAIN LIST - DC RETURNS": menu 251 list (TxnMainView).
--   220 "POPUP - CHALLANS TO RETURN": menu 251 F4, posted challans with something open.
--   221 "CHALLAN - USED ON": History > Used on of a challan (bill lines and challan returns).
--
-- WHY A TARGETED SEED RATHER THAN AN EDIT TO Grid_Details.sql / Grid_Columns.sql
--   Those two are exports (npm run seed:export:ui-config), and Grid_Columns.sql
--   skips any grid that already has a column (precedent: Delivery_Grids_212_218.sql,
--   Sale_Return_Grids_207_211.sql). It runs after both (manifest order). The change to
--   the existing grid 116 (days, open, kg, age level) is in Grid_Details.sql /
--   Grid_Columns.sql themselves.
--
-- The grid_sql text is byte-identical to the migration's and holds no comment
-- marker (the runner refuses one). Grid 221 is a WITH ... SELECT whose top-level
-- FROM names its CTE (used_on): the run route anchors on that relation and refuses
-- a derived table there. grid_column ids are pinned (the migration's),
-- so every database ends up with the same rows. Tokens are compared as text; every
-- caller sends every token ('' = off).
--
-- Idempotent: ON CONFLICT (grid_id) DO NOTHING keeps a grid a site has edited;
-- a column goes in only under a grid of the expected name with no live column of
-- that number. Safe to re-run.
-- Run: psql "$DATABASE_URL" -f prisma/seed/DC_Grids_219_221.sql
--      or: npm run seed:run -- --only=DC_Grids_219_221.sql

BEGIN;

INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_sort_column, grid_sort_order, grid_device_type,
        grid_status, grid_is_deleted, grid_created_by, grid_sql)
VALUES
(219, 'MAIN LIST - DC RETURNS',
 'Challan Return list (menu 251, TxnMainView). Tokens (send every one; '''' = no bound): icompany_id, ibranch_id, iacc_year, ifrom_date, ito_date (yyyy-MM-dd, on sdr_return_date). One row per return: its lines, the qty and kg back (kg from the challan line''s per-unit weight, else the unit''s), the cost back, the status. Newest first.',
 'sdr_return_date', 'Descending', 'Desktop', true, false, 'system',
$g219$SELECT r.sdr_id,
       r.sdr_company_id,
       r.sdr_branch_id,
       r.sdr_acc_year,
       r.sdr_return_date,
       r.sdr_return_refno,
       r.sdr_dc_refno,
       r.sdr_cust_name,
       COALESCE(rs.srm_name, r.sdr_return_reason, '') AS reason_name,
       COALESCE(li.line_count, 0) AS line_count,
       round(COALESCE(li.return_qty, 0), 3) AS return_qty,
       round(COALESCE(li.return_kg, 0), 3) AS return_kg,
       r.sdr_total_cost,
       r.sdr_status,
       COALESCE(NULLIF(u.usr_display_name, ''), u.usr_login_name, r.sdr_created_by) AS sdr_created_by_name,
       r.sdr_dc_id,
       r.sdr_dc_acc_year,
       r.sdr_dc_date,
       r.sdr_cust_id,
       r.sdr_print_count,
       r.sdr_device_id,
       r.sdr_return_slno
  FROM sales.sale_dc_return r
  LEFT JOIN stock.stock_reason_master rs ON rs.srm_id = r.sdr_reason_id
  LEFT JOIN LATERAL (SELECT count(*) AS line_count,
                            SUM(ri.sdri_return_qty) AS return_qty,
                            SUM(ri.sdri_return_qty * CASE WHEN di.sdi_weight_qty > 0 AND di.sdi_dc_qty > 0
                                                          THEN di.sdi_weight_qty / di.sdi_dc_qty
                                                          ELSE COALESCE(u2.iuc_uom_weight, 0) END) AS return_kg
                       FROM sales.sale_dc_return_item ri
                       LEFT JOIN sales.sale_dc_item di ON di.sdi_id = ri.sdri_dc_item_id AND di.sdi_acc_year = ri.sdri_dc_acc_year
                       LEFT JOIN inventory.item_unit_conversion u2 ON u2.iuc_id = ri.sdri_item_unit_id
                      WHERE ri.sdri_return_id = r.sdr_id
                        AND ri.sdri_acc_year = r.sdr_acc_year
                        AND ri.sdri_is_deleted = false) li ON true
  LEFT JOIN public.user_master u ON u.usr_id::text = r.sdr_created_by
 WHERE r.sdr_company_id::text = 'icompany_id'
   AND r.sdr_branch_id::text = 'ibranch_id'
   AND r.sdr_acc_year = 'iacc_year'
   AND r.sdr_is_deleted = false
   AND (NULLIF('ifrom_date', '') IS NULL OR r.sdr_return_date::text >= 'ifrom_date')
   AND (NULLIF('ito_date', '') IS NULL OR r.sdr_return_date::text <= 'ito_date')
 ORDER BY r.sdr_return_date DESC, r.sdr_created_on DESC$g219$),
(220, 'POPUP - CHALLANS TO RETURN',
 'Challan Return (menu 251) F4 picker: one row per POSTED, live challan of the branch with something still open (a line with sdi_open_qty > 0). Tokens (send every one; '''' = all): icompany_id, ibranch_id, icust_id, igodown_id (only challans with an open line in that godown; godown_names lists every godown with an open line), iamber_days, iold_days (as grid 116). open_text = open of sent, over the whole challan; on_drafts = the qty on its DRAFT returns (a draft holds nothing, Q17). Newest first.',
 'sdc_dc_date', 'Descending', 'Desktop', true, false, 'system',
$g220$SELECT d.sdc_id,
       d.sdc_acc_year,
       d.sdc_company_id,
       d.sdc_branch_id,
       d.sdc_dc_refno,
       d.sdc_dc_date,
       (CURRENT_DATE - d.sdc_dc_date) AS days,
       CASE WHEN d.sdc_purpose = 'SUPPLY' THEN
                 CASE WHEN CURRENT_DATE - d.sdc_dc_date > lim.old_days THEN 'RED'
                      WHEN CURRENT_DATE - d.sdc_dc_date > lim.amber_days THEN 'AMBER'
                      ELSE '' END
            WHEN win.window_days IS NOT NULL AND CURRENT_DATE - d.sdc_dc_date > win.window_days THEN 'RED'
            ELSE '' END AS age_level,
       d.sdc_cust_id,
       COALESCE(c.cus_name, d.sdc_cust_name) AS cust_name,
       COALESCE(a.arm_name, '') AS area_name,
       d.sdc_purpose,
       initcap(replace(d.sdc_purpose, '_', ' ')) AS purpose_name,
       COALESCE(ol.godown_names, '') AS godown_names,
       trim_scale(round(ol.open_pkgs, 3)) || ' of ' || trim_scale(round(ol.total_pkgs, 3)) AS open_text,
       round(ol.open_pkgs, 3) AS open_pkgs,
       round(ol.total_pkgs, 3) AS total_pkgs,
       round(COALESCE(ol.open_kg, 0), 3) AS open_kg,
       round(COALESCE(dr.on_drafts, 0), 3) AS on_drafts
  FROM sales.sale_dc d
  CROSS JOIN (SELECT COALESCE(substring('iamber_days' FROM '^[0-9]{1,4}$')::integer, 7) AS amber_days,
                     COALESCE(substring('iold_days' FROM '^[0-9]{1,4}$')::integer, 30) AS old_days) lim
  JOIN LATERAL (SELECT SUM(di.sdi_open_qty) FILTER (WHERE di.sdi_open_qty > 0) AS open_pkgs,
                       SUM(di.sdi_dc_qty) AS total_pkgs,
                       SUM(di.sdi_open_qty * CASE WHEN di.sdi_weight_qty > 0 AND di.sdi_dc_qty > 0
                                                  THEN di.sdi_weight_qty / di.sdi_dc_qty
                                                  ELSE COALESCE(u.iuc_uom_weight, 0) END)
                           FILTER (WHERE di.sdi_open_qty > 0) AS open_kg,
                       string_agg(DISTINCT g.gdl_name, ', ') FILTER (WHERE di.sdi_open_qty > 0) AS godown_names,
                       count(*) FILTER (WHERE di.sdi_open_qty > 0
                                          AND ('igodown_id' = '' OR di.sdi_godown_id::text = 'igodown_id')) AS lines_in_scope
                  FROM sales.sale_dc_item di
                  LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = di.sdi_item_unit_id
                  LEFT JOIN inventory.godown_locations g ON g.gdl_id = di.sdi_godown_id
                 WHERE di.sdi_dc_id = d.sdc_id
                   AND di.sdi_acc_year = d.sdc_acc_year
                   AND di.sdi_is_deleted = false) ol ON ol.lines_in_scope > 0
  LEFT JOIN sales.customers c ON c.cus_id = d.sdc_cust_id
  LEFT JOIN sales.area_master a ON a.arm_id = c.cus_area_id
  LEFT JOIN LATERAL (SELECT SUM(ri.sdri_return_qty) AS on_drafts
                       FROM sales.sale_dc_return h
                       JOIN sales.sale_dc_return_item ri ON ri.sdri_return_id = h.sdr_id AND ri.sdri_acc_year = h.sdr_acc_year
                      WHERE h.sdr_dc_id = d.sdc_id
                        AND h.sdr_dc_acc_year = d.sdc_acc_year
                        AND h.sdr_status = 'DRAFT'
                        AND h.sdr_is_deleted = false
                        AND ri.sdri_is_deleted = false) dr ON true
  LEFT JOIN LATERAL (SELECT s.stl_value AS window_days
                       FROM public.statutory_limits s
                      WHERE d.sdc_purpose <> 'SUPPLY'
                        AND s.stl_code = 'DC_RETURN_WINDOW_DAYS'
                        AND s.stl_is_deleted = false
                        AND s.stl_is_active = true
                        AND (s.stl_company_id IS NULL OR s.stl_company_id = d.sdc_company_id)
                        AND s.stl_applies_to = 'ALL'
                        AND s.stl_aato_class IS NULL
                        AND s.stl_effective_from <= d.sdc_dc_date
                        AND (s.stl_effective_to IS NULL OR s.stl_effective_to >= d.sdc_dc_date)
                      ORDER BY (s.stl_company_id IS NOT NULL) DESC, s.stl_effective_from DESC
                      LIMIT 1) win ON true
 WHERE d.sdc_company_id::text = 'icompany_id'
   AND d.sdc_branch_id::text = 'ibranch_id'
   AND d.sdc_is_deleted = false
   AND d.sdc_status = 'POSTED'
   AND ('icust_id' = '' OR d.sdc_cust_id::text = 'icust_id')
 ORDER BY d.sdc_dc_date DESC, d.sdc_created_on DESC$g220$),
(221, 'CHALLAN - USED ON',
 'Challan History, Used on (menus 182 / 251): every POSTED Sales Bill line that names a line of this challan (sbi_src_doc_type DELIVERY_CHALLAN) and every POSTED challan-return line. Tokens (send every one): icompany_id, idc_id (the sdc_id), iacc_year (the challan''s year). when_text is IST 12-hour; kind BILL opens menu 12, RETURN opens menu 251. Newest first.',
 'when_sort', 'Descending', 'Desktop', true, false, 'system',
$g221$WITH used_on AS (
        SELECT to_char(b.sb_bill_datetime AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY HH12:MI AM') AS when_text,
               'Sales Bill ' || b.sb_bill_refno AS doc_text,
               'bill line ' || bi.sbi_line_no || ' ← challan line ' || di.sdi_line_no AS line_text,
               im.item_name_en AS item_name,
               round(bi.sbi_bill_qty, 3) AS qty,
               COALESCE(um.unit_name, '') AS unit_name,
               COALESCE(NULLIF(us.usr_display_name, ''), us.usr_login_name, b.sb_created_by) AS by_name,
               'BILL' AS kind,
               b.sb_id AS doc_id,
               b.sb_acc_year AS doc_acc_year,
               b.sb_bill_refno AS doc_refno,
               bi.sbi_line_no AS doc_line_no,
               di.sdi_line_no AS dc_line_no,
               di.sdi_id AS dc_item_id,
               '' AS condition,
               to_char(b.sb_bill_datetime AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI:SS') AS when_sort,
               b.sb_bill_datetime AS when_at
          FROM sales.sale_dc d
          JOIN sales.sale_dc_item di ON di.sdi_dc_id = d.sdc_id AND di.sdi_acc_year = d.sdc_acc_year
          JOIN sales.sale_bill_item bi ON bi.sbi_src_item_id = di.sdi_id AND bi.sbi_src_doc_type = 'DELIVERY_CHALLAN'
          JOIN sales.sale_bill b ON b.sb_id = bi.sbi_bill_id AND b.sb_acc_year = bi.sbi_acc_year
          JOIN inventory.item_master im ON im.item_id = bi.sbi_item_id
          LEFT JOIN inventory.item_unit_conversion iu ON iu.iuc_id = bi.sbi_item_unit_id
          LEFT JOIN inventory.item_unit_master um ON um.unit_id = iu.iuc_unit_id
          LEFT JOIN public.user_master us ON us.usr_id::text = b.sb_created_by
         WHERE d.sdc_company_id::text = 'icompany_id'
           AND d.sdc_id::text = 'idc_id'
           AND d.sdc_acc_year = 'iacc_year'
           AND di.sdi_is_deleted = false
           AND bi.sbi_is_deleted = false
           AND b.sb_is_deleted = false
           AND b.sb_status = 'POSTED'
        UNION ALL
        SELECT to_char(h.sdr_return_datetime AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY HH12:MI AM'),
               'Challan Return ' || h.sdr_return_refno,
               'line ' || di.sdi_line_no
                 || CASE WHEN row_number() OVER (PARTITION BY ri.sdri_return_id, ri.sdri_dc_item_id ORDER BY ri.sdri_line_no) > 1
                         THEN '·' || row_number() OVER (PARTITION BY ri.sdri_return_id, ri.sdri_dc_item_id ORDER BY ri.sdri_line_no)
                         ELSE '' END
                 || ' · ' || initcap(ri.sdri_condition),
               im.item_name_en,
               round(ri.sdri_return_qty, 3),
               COALESCE(um.unit_name, ''),
               COALESCE(NULLIF(us.usr_display_name, ''), us.usr_login_name, h.sdr_created_by),
               'RETURN',
               h.sdr_id,
               h.sdr_acc_year,
               h.sdr_return_refno,
               ri.sdri_line_no,
               di.sdi_line_no,
               di.sdi_id,
               ri.sdri_condition,
               to_char(h.sdr_return_datetime AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI:SS'),
               h.sdr_return_datetime
          FROM sales.sale_dc d
          JOIN sales.sale_dc_item di ON di.sdi_dc_id = d.sdc_id AND di.sdi_acc_year = d.sdc_acc_year
          JOIN sales.sale_dc_return_item ri ON ri.sdri_dc_item_id = di.sdi_id AND ri.sdri_dc_acc_year = di.sdi_acc_year
          JOIN sales.sale_dc_return h ON h.sdr_id = ri.sdri_return_id AND h.sdr_acc_year = ri.sdri_acc_year
          JOIN inventory.item_master im ON im.item_id = ri.sdri_item_id
          LEFT JOIN inventory.item_unit_conversion iu ON iu.iuc_id = ri.sdri_item_unit_id
          LEFT JOIN inventory.item_unit_master um ON um.unit_id = iu.iuc_unit_id
          LEFT JOIN public.user_master us ON us.usr_id::text = h.sdr_created_by
         WHERE d.sdc_company_id::text = 'icompany_id'
           AND d.sdc_id::text = 'idc_id'
           AND d.sdc_acc_year = 'iacc_year'
           AND di.sdi_is_deleted = false
           AND ri.sdri_is_deleted = false
           AND h.sdr_is_deleted = false
           AND h.sdr_status = 'POSTED')
SELECT x.when_text,
       x.doc_text,
       x.line_text,
       x.item_name,
       x.qty,
       x.unit_name,
       x.by_name,
       x.kind,
       x.doc_id,
       x.doc_acc_year,
       x.doc_refno,
       x.doc_line_no,
       x.dc_line_no,
       x.dc_item_id,
       x.condition,
       x.when_sort
  FROM used_on x
 ORDER BY x.when_at DESC, x.kind, x.doc_refno, x.doc_line_no$g221$)
ON CONFLICT (grid_id) DO NOTHING;

INSERT INTO fixed.grid_columns
       (grid_column_id, grid_id, grid_column_number, grid_column_name, grid_column_sql_field_name,
        grid_column_data_type, grid_column_width, grid_column_position, grid_column_alignment,
        grid_column_visibility, grid_column_filter, grid_column_group, grid_column_total,
        grid_column_notes, grid_column_is_deleted, grid_column_created_by)
SELECT v.id, v.grid, v.no, v.name, v.fld, v.typ, v.width, v.no, v.align, v.visible, v.filter,
       false, false, v.fld, false, 'system'
  FROM (VALUES
    -- 219 MAIN LIST - DC RETURNS
    ('01a1e5d0-2190-7000-8000-000000219001'::uuid, 219::bigint, 1::integer, '#'::text, 'sdr_id'::text, 'Text'::text, 0.00::numeric, 'Left'::text, false::boolean, false::boolean)
   ,('01a1e5d0-2190-7000-8000-000000219002', 219, 2, 'Company', 'sdr_company_id', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2190-7000-8000-000000219003', 219, 3, 'Branch', 'sdr_branch_id', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2190-7000-8000-000000219004', 219, 4, 'Year', 'sdr_acc_year', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2190-7000-8000-000000219005', 219, 5, 'Date', 'sdr_return_date', 'Date', 8.00, 'Left', true, false)
   ,('01a1e5d0-2190-7000-8000-000000219006', 219, 6, 'Return No', 'sdr_return_refno', 'Text', 13.00, 'Left', true, true)
   ,('01a1e5d0-2190-7000-8000-000000219007', 219, 7, 'Challan', 'sdr_dc_refno', 'Text', 12.00, 'Left', true, true)
   ,('01a1e5d0-2190-7000-8000-000000219008', 219, 8, 'Customer', 'sdr_cust_name', 'Text', 17.00, 'Left', true, true)
   ,('01a1e5d0-2190-7000-8000-000000219009', 219, 9, 'Reason', 'reason_name', 'Text', 12.00, 'Left', true, true)
   ,('01a1e5d0-2190-7000-8000-000000219010', 219, 10, 'Lines', 'line_count', 'Number', 5.00, 'Right', true, false)
   ,('01a1e5d0-2190-7000-8000-000000219011', 219, 11, 'Qty', 'return_qty', 'Number', 6.00, 'Right', true, false)
   ,('01a1e5d0-2190-7000-8000-000000219012', 219, 12, 'Kg', 'return_kg', 'Number', 6.00, 'Right', true, false)
   ,('01a1e5d0-2190-7000-8000-000000219013', 219, 13, 'Cost back', 'sdr_total_cost', 'Number', 8.00, 'Right', true, false)
   ,('01a1e5d0-2190-7000-8000-000000219014', 219, 14, 'Status', 'sdr_status', 'Text', 7.00, 'Center', true, false)
   ,('01a1e5d0-2190-7000-8000-000000219015', 219, 15, 'By', 'sdr_created_by_name', 'Text', 6.00, 'Left', true, false)
   ,('01a1e5d0-2190-7000-8000-000000219016', 219, 16, 'Challan id', 'sdr_dc_id', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2190-7000-8000-000000219017', 219, 17, 'Challan year', 'sdr_dc_acc_year', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2190-7000-8000-000000219018', 219, 18, 'Challan date', 'sdr_dc_date', 'Date', 0.00, 'Left', false, false)
   ,('01a1e5d0-2190-7000-8000-000000219019', 219, 19, 'Customer id', 'sdr_cust_id', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2190-7000-8000-000000219020', 219, 20, 'Prints', 'sdr_print_count', 'Number', 0.00, 'Right', false, false)
   ,('01a1e5d0-2190-7000-8000-000000219021', 219, 21, 'Device', 'sdr_device_id', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2190-7000-8000-000000219022', 219, 22, 'Slno', 'sdr_return_slno', 'Number', 0.00, 'Right', false, false)
    -- 220 POPUP - CHALLANS TO RETURN (DC no 15.65: a 15-character number such as DC2627D14-00015 fits)
   ,('01a1e5d0-2200-7000-8000-000000220001', 220, 1, '#', 'sdc_id', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2200-7000-8000-000000220002', 220, 2, 'Year', 'sdc_acc_year', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2200-7000-8000-000000220003', 220, 3, 'Company', 'sdc_company_id', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2200-7000-8000-000000220004', 220, 4, 'Branch', 'sdc_branch_id', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2200-7000-8000-000000220005', 220, 5, 'DC no', 'sdc_dc_refno', 'Text', 15.65, 'Left', true, true)
   ,('01a1e5d0-2200-7000-8000-000000220006', 220, 6, 'Date', 'sdc_dc_date', 'Date', 9.95, 'Left', true, false)
   ,('01a1e5d0-2200-7000-8000-000000220007', 220, 7, 'Days', 'days', 'Number', 5.32, 'Right', true, false)
   ,('01a1e5d0-2200-7000-8000-000000220008', 220, 8, 'Age level', 'age_level', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2200-7000-8000-000000220009', 220, 9, 'Customer id', 'sdc_cust_id', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2200-7000-8000-000000220010', 220, 10, 'Customer', 'cust_name', 'Text', 12.45, 'Left', true, true)
   ,('01a1e5d0-2200-7000-8000-000000220011', 220, 11, 'Area', 'area_name', 'Text', 10.11, 'Left', true, true)
   ,('01a1e5d0-2200-7000-8000-000000220012', 220, 12, 'Purpose code', 'sdc_purpose', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2200-7000-8000-000000220013', 220, 13, 'Purpose', 'purpose_name', 'Text', 8.33, 'Left', true, false)
   ,('01a1e5d0-2200-7000-8000-000000220014', 220, 14, 'Godown', 'godown_names', 'Text', 10.65, 'Left', true, true)
   ,('01a1e5d0-2200-7000-8000-000000220015', 220, 15, 'Open of sent', 'open_text', 'Text', 11.11, 'Right', true, false)
   ,('01a1e5d0-2200-7000-8000-000000220016', 220, 16, 'Open', 'open_pkgs', 'Number', 0.00, 'Right', false, false)
   ,('01a1e5d0-2200-7000-8000-000000220017', 220, 17, 'Sent', 'total_pkgs', 'Number', 0.00, 'Right', false, false)
   ,('01a1e5d0-2200-7000-8000-000000220018', 220, 18, 'Kg open', 'open_kg', 'Number', 8.10, 'Right', true, false)
   ,('01a1e5d0-2200-7000-8000-000000220019', 220, 19, 'On drafts', 'on_drafts', 'Number', 8.33, 'Right', true, false)
    -- 221 CHALLAN - USED ON
   ,('01a1e5d0-2210-7000-8000-000000221001', 221, 1, 'When', 'when_text', 'Text', 11.77, 'Left', true, false)
   ,('01a1e5d0-2210-7000-8000-000000221002', 221, 2, 'Document', 'doc_text', 'Text', 20.08, 'Left', true, true)
   ,('01a1e5d0-2210-7000-8000-000000221003', 221, 3, 'Line', 'line_text', 'Text', 16.62, 'Left', true, false)
   ,('01a1e5d0-2210-7000-8000-000000221004', 221, 4, 'Item', 'item_name', 'Text', 36.28, 'Left', true, true)
   ,('01a1e5d0-2210-7000-8000-000000221005', 221, 5, 'Qty', 'qty', 'Number', 4.16, 'Right', true, false)
   ,('01a1e5d0-2210-7000-8000-000000221006', 221, 6, 'Unit', 'unit_name', 'Text', 4.16, 'Left', true, false)
   ,('01a1e5d0-2210-7000-8000-000000221007', 221, 7, 'By', 'by_name', 'Text', 6.93, 'Left', true, false)
   ,('01a1e5d0-2210-7000-8000-000000221008', 221, 8, 'Kind', 'kind', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2210-7000-8000-000000221009', 221, 9, 'Doc id', 'doc_id', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2210-7000-8000-000000221010', 221, 10, 'Doc year', 'doc_acc_year', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2210-7000-8000-000000221011', 221, 11, 'Doc no', 'doc_refno', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2210-7000-8000-000000221012', 221, 12, 'Doc line', 'doc_line_no', 'Number', 0.00, 'Right', false, false)
   ,('01a1e5d0-2210-7000-8000-000000221013', 221, 13, 'Challan line', 'dc_line_no', 'Number', 0.00, 'Right', false, false)
   ,('01a1e5d0-2210-7000-8000-000000221014', 221, 14, 'Challan line id', 'dc_item_id', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2210-7000-8000-000000221015', 221, 15, 'Condition', 'condition', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2210-7000-8000-000000221016', 221, 16, 'Sort', 'when_sort', 'Text', 0.00, 'Left', false, false)
       ) v(id, grid, no, name, fld, typ, width, align, visible, filter)
 WHERE EXISTS (SELECT 1 FROM fixed.grid_details d
                WHERE d.grid_id = v.grid
                  AND d.grid_name IN ('MAIN LIST - DC RETURNS', 'POPUP - CHALLANS TO RETURN', 'CHALLAN - USED ON'))
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns e
                    WHERE e.grid_id = v.grid AND e.grid_column_number = v.no AND e.grid_column_is_deleted = false)
ON CONFLICT (grid_column_id) DO NOTHING;

-- Keep the identity sequence ahead of the seeded ids.
SELECT setval('fixed.grid_details_grid_id_seq',
              GREATEST((SELECT COALESCE(max(grid_id), 1) FROM fixed.grid_details),
                       (SELECT last_value FROM fixed.grid_details_grid_id_seq)));

COMMIT;
