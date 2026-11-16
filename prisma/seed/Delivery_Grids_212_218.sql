-- Delivery tracking phase 1 -- grids 212 to 218, the same rows migration
-- 20261117100000_delivery_tracking writes (plan
-- Shared/Prathap/sales/plan-delivery-tracking-p1-2026-11-15.md §7.7).
--
--   212 "MAIN LIST - PENDING DELIVERIES": menu 304 bill-wise list (BILL rows, then DC rows).
--   213 "PENDING DELIVERIES - BEATS": menu 304 city / area tree.
--   214 "PENDING DELIVERIES - ITEM-WISE": menu 304 Item-wise tab.
--   215 "PENDING DELIVERIES - OPEN LINES": menu 304 lines pane of one bill.
--   216 "MAIN LIST - DELIVERY NOTES": menu 305 list (TxnMainView).
--   217 "POPUP - DELIVERY NOTE PENDINGS": menu 305 F4, one godown's open bills.
--   218 "POPUP - BILL DELIVERIES": one bill's delivery events (the Sale Bill's chip).
--
-- WHY A TARGETED SEED RATHER THAN AN EDIT TO Grid_Details.sql / Grid_Columns.sql
--   Those two are exports (npm run seed:export:ui-config), and Grid_Columns.sql
--   skips any grid that already has a column (precedent:
--   Sale_Return_Grids_207_211.sql). It runs after both (manifest order).
--
-- The grid_sql text is byte-identical to the migration's and holds no comment
-- marker (the runner refuses one). grid_column ids are pinned (the migration's),
-- so every database ends up with the same rows. Pending is always worked out
-- from sales.sale_delivery_event (billed - settled); nothing here is stored.
--
-- Idempotent: ON CONFLICT (grid_id) DO NOTHING keeps a grid a site has edited;
-- a column goes in only under a grid of the expected name with no live column of
-- that number. Safe to re-run.
-- Run: psql "$DATABASE_URL" -f prisma/seed/Delivery_Grids_212_218.sql
--      or: npm run seed:run -- --only=Delivery_Grids_212_218.sql

BEGIN;

INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_sort_column, grid_sort_order, grid_device_type,
        grid_status, grid_is_deleted, grid_created_by, grid_sql)
VALUES
(212, 'MAIN LIST - PENDING DELIVERIES',
 'Pending Deliveries (menu 304) bill-wise list. One BILL row per posted Pickup / Dispatch bill with an eligible line still to give (pending = billed - settled, never stored; an over-given line counts too, shown negative), oldest first; then one DC row per posted delivery challan with open lines (sdi_open_qty > 0). No money. Tokens (send every one; '''' = no filter): icompany_id, ibranch_id, igodown_id (open lines of that godown; godown_names lists every godown still to give), icust_id, isalesman_id, iarea_ids (comma list of arm_id; NONE = customers with no area), imodes (''PICKUP,DISPATCH''), ichallans (''true'' = add the DC rows), iamber_days, iold_days (age_band NEW / AMBER / OLD; '''' = 7 / 30).',
 'doc_date', 'Ascending', 'Desktop', true, false, 'system',
$g212$WITH pl AS (
  SELECT b.sb_id, b.sb_acc_year, i.sbi_godown_id,
         i.sbi_bill_qty - COALESCE(ev.settled_qty, 0) AS pending_qty,
         CASE WHEN i.sbi_weight_qty > 0 AND i.sbi_bill_qty > 0 THEN i.sbi_weight_qty / i.sbi_bill_qty
              ELSE COALESCE(u.iuc_uom_weight, 0) END AS unit_kg,
         ('igodown_id' = '' OR i.sbi_godown_id::text = 'igodown_id') AS in_scope
    FROM sales.sale_bill b
    JOIN sales.sale_bill_item i ON i.sbi_bill_id = b.sb_id AND i.sbi_acc_year = b.sb_acc_year
    LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = i.sbi_item_unit_id
    LEFT JOIN LATERAL (SELECT SUM(e.sde_settle_qty) AS settled_qty
                         FROM sales.sale_delivery_event e
                        WHERE e.sde_bill_item_id = i.sbi_id
                          AND e.sde_bill_acc_year = i.sbi_acc_year
                          AND e.sde_is_deleted = false) ev ON true
   WHERE b.sb_company_id::text = 'icompany_id'
     AND b.sb_branch_id::text = 'ibranch_id'
     AND b.sb_is_deleted = false
     AND b.sb_status = 'POSTED'
     AND b.sb_delivery_mode IN ('PICKUP', 'DISPATCH')
     AND b.sb_delivery_status IN ('PENDING', 'PART', 'OUT')
     AND ('imodes' = '' OR b.sb_delivery_mode = ANY (string_to_array('imodes', ',')))
     AND ('icust_id' = '' OR b.sb_cust_id::text = 'icust_id')
     AND ('isalesman_id' = '' OR 'isalesman_id' = ANY (b.sb_salesman_id::text[]))
     AND i.sbi_is_deleted = false
     AND i.sbi_is_service = false
     AND COALESCE(i.sbi_src_doc_type, '') <> 'DELIVERY_CHALLAN'
     AND i.sbi_bill_qty > 0
),
ob AS (
  SELECT p.sb_id, p.sb_acc_year,
         count(*) FILTER (WHERE p.in_scope) AS open_lines,
         SUM(p.pending_qty) FILTER (WHERE p.in_scope) AS open_pkgs,
         SUM(p.pending_qty * p.unit_kg) FILTER (WHERE p.in_scope) AS open_kg,
         string_agg(DISTINCT g.gdl_name, ', ') AS godown_names,
         count(DISTINCT p.sbi_godown_id) AS godown_count
    FROM pl p
    LEFT JOIN inventory.godown_locations g ON g.gdl_id = p.sbi_godown_id
   WHERE p.pending_qty <> 0
   GROUP BY p.sb_id, p.sb_acc_year
  HAVING count(*) FILTER (WHERE p.in_scope) > 0
),
dl AS (
  SELECT d.sdc_id, d.sdc_acc_year,
         count(*) FILTER (WHERE di.sdi_open_qty > 0 AND ('igodown_id' = '' OR di.sdi_godown_id::text = 'igodown_id')) AS open_lines,
         SUM(di.sdi_open_qty) FILTER (WHERE di.sdi_open_qty > 0 AND ('igodown_id' = '' OR di.sdi_godown_id::text = 'igodown_id')) AS open_pkgs,
         SUM(di.sdi_open_qty * CASE WHEN di.sdi_weight_qty > 0 AND di.sdi_dc_qty > 0 THEN di.sdi_weight_qty / di.sdi_dc_qty
                                    ELSE COALESCE(u.iuc_uom_weight, 0) END)
             FILTER (WHERE di.sdi_open_qty > 0 AND ('igodown_id' = '' OR di.sdi_godown_id::text = 'igodown_id')) AS open_kg,
         SUM(di.sdi_dc_qty) AS total_pkgs,
         SUM(di.sdi_billed_qty) AS billed_pkgs,
         string_agg(DISTINCT g.gdl_name, ', ') FILTER (WHERE di.sdi_open_qty > 0) AS godown_names,
         count(DISTINCT di.sdi_godown_id) FILTER (WHERE di.sdi_open_qty > 0) AS godown_count
    FROM sales.sale_dc d
    JOIN sales.sale_dc_item di ON di.sdi_dc_id = d.sdc_id AND di.sdi_acc_year = d.sdc_acc_year
    LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = di.sdi_item_unit_id
    LEFT JOIN inventory.godown_locations g ON g.gdl_id = di.sdi_godown_id
   WHERE 'ichallans' = 'true'
     AND d.sdc_company_id::text = 'icompany_id'
     AND d.sdc_branch_id::text = 'ibranch_id'
     AND d.sdc_is_deleted = false
     AND d.sdc_status = 'POSTED'
     AND ('icust_id' = '' OR d.sdc_cust_id::text = 'icust_id')
     AND ('isalesman_id' = '' OR 'isalesman_id' = ANY (d.sdc_salesman_id::text[]))
     AND di.sdi_is_deleted = false
   GROUP BY d.sdc_id, d.sdc_acc_year
  HAVING count(*) FILTER (WHERE di.sdi_open_qty > 0 AND ('igodown_id' = '' OR di.sdi_godown_id::text = 'igodown_id')) > 0
),
lim AS (
  SELECT COALESCE(NULLIF('iamber_days', '')::integer, 7) AS amber_days,
         COALESCE(NULLIF('iold_days', '')::integer, 30) AS old_days
),
r AS (
  SELECT 'BILL' AS row_kind, 0 AS kind_sort,
         b.sb_id AS doc_id, b.sb_acc_year AS doc_acc_year, b.sb_company_id AS company_id, b.sb_branch_id AS branch_id,
         b.sb_bill_refno AS doc_refno, b.sb_bill_date AS doc_date,
         b.sb_cust_id AS cust_id, COALESCE(c.cus_name, b.sb_cust_name) AS cust_name,
         c.cus_area_id AS area_uuid, b.sb_salesman_id AS salesman_ids,
         b.sb_delivery_mode AS delivery_mode, b.sb_delivery_status AS delivery_status,
         ob.godown_names, ob.godown_count, ob.open_lines, ob.open_pkgs, ob.open_kg,
         COALESCE(lg.sde_src_refno || ' · ' || to_char(lg.sde_event_datetime AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY HH12:MI AM'), '') AS last_given,
         lg.sde_src_doc_id AS last_note_id, lg.sde_src_acc_year AS last_note_acc_year
    FROM ob
    JOIN sales.sale_bill b ON b.sb_id = ob.sb_id AND b.sb_acc_year = ob.sb_acc_year
    LEFT JOIN sales.customers c ON c.cus_id = b.sb_cust_id
    LEFT JOIN LATERAL (SELECT e.sde_src_refno, e.sde_event_datetime, e.sde_src_doc_id, e.sde_src_acc_year
                         FROM sales.sale_delivery_event e
                        WHERE e.sde_bill_id = b.sb_id
                          AND e.sde_bill_acc_year = b.sb_acc_year
                          AND e.sde_kind = 'GIVEN'
                          AND e.sde_is_deleted = false
                          AND NOT EXISTS (SELECT 1 FROM sales.sale_delivery_event x
                                           WHERE x.sde_reverses_id = e.sde_id
                                             AND x.sde_kind = 'CANCEL')
                        ORDER BY e.sde_event_datetime DESC, e.sde_created_on DESC
                        LIMIT 1) lg ON true
  UNION ALL
  SELECT 'DC', 1,
         d.sdc_id, d.sdc_acc_year, d.sdc_company_id, d.sdc_branch_id,
         d.sdc_dc_refno, d.sdc_dc_date,
         d.sdc_cust_id, COALESCE(c.cus_name, d.sdc_cust_name),
         c.cus_area_id, d.sdc_salesman_id,
         'DC', CASE WHEN dl.billed_pkgs > 0 THEN 'DC PART-BILLED' ELSE 'DC OPEN' END,
         dl.godown_names, dl.godown_count, dl.open_lines, dl.open_pkgs, dl.open_kg,
         'open ' || trim_scale(dl.open_pkgs) || ' of ' || trim_scale(dl.total_pkgs),
         NULL::uuid, NULL::character(9)
    FROM dl
    JOIN sales.sale_dc d ON d.sdc_id = dl.sdc_id AND d.sdc_acc_year = dl.sdc_acc_year
    LEFT JOIN sales.customers c ON c.cus_id = d.sdc_cust_id
)
SELECT r.row_kind, r.doc_id, r.doc_acc_year, r.company_id, r.branch_id,
       r.doc_refno, r.doc_date,
       (CURRENT_DATE - r.doc_date) AS days_old,
       CASE WHEN CURRENT_DATE - r.doc_date > lim.old_days THEN 'OLD'
            WHEN CURRENT_DATE - r.doc_date > lim.amber_days THEN 'AMBER'
            ELSE 'NEW' END AS age_band,
       r.cust_id, r.cust_name,
       COALESCE(a.arm_id::text, 'NONE') AS area_id, COALESCE(a.arm_name, '(no area)') AS area_name,
       COALESCE(ct.ctm_name, '') AS city_name,
       COALESCE(sm.names, '') AS salesman_names,
       r.delivery_mode, r.delivery_status,
       COALESCE(r.godown_names, '') AS godown_names, r.godown_count, r.open_lines,
       round(r.open_pkgs, 3) AS open_pkgs, round(COALESCE(r.open_kg, 0), 3) AS open_kg,
       r.last_given, r.last_note_id, r.last_note_acc_year
  FROM r
  CROSS JOIN lim
  LEFT JOIN sales.area_master a ON a.arm_id = r.area_uuid
  LEFT JOIN sales.city_master ct ON ct.ctm_id = a.arm_city_id
  LEFT JOIN LATERAL (SELECT string_agg(em.emp_name, ', ' ORDER BY em.emp_name) AS names
                       FROM public.employee_master em
                      WHERE em.emp_id = ANY (r.salesman_ids)) sm ON true
 WHERE ('iarea_ids' = '' OR COALESCE(a.arm_id::text, 'NONE') = ANY (string_to_array('iarea_ids', ',')))
 ORDER BY r.kind_sort, r.doc_date, r.doc_refno$g212$),
(213, 'PENDING DELIVERIES - BEATS',
 'Pending Deliveries (menu 304) beats tree: one row per city and area of the customers with something to give: bills, kg and ton of their open lines, and the open challans when ichallans = ''true''. NONE / (no area) for a customer with no area. Tokens as grid 212 without iarea_ids: icompany_id, ibranch_id, igodown_id, icust_id, isalesman_id, imodes, ichallans.',
 'city_name', 'Ascending', 'Desktop', true, false, 'system',
$g213$WITH pl AS (
  SELECT b.sb_id, b.sb_acc_year, b.sb_cust_id,
         i.sbi_bill_qty - COALESCE(ev.settled_qty, 0) AS pending_qty,
         CASE WHEN i.sbi_weight_qty > 0 AND i.sbi_bill_qty > 0 THEN i.sbi_weight_qty / i.sbi_bill_qty
              ELSE COALESCE(u.iuc_uom_weight, 0) END AS unit_kg
    FROM sales.sale_bill b
    JOIN sales.sale_bill_item i ON i.sbi_bill_id = b.sb_id AND i.sbi_acc_year = b.sb_acc_year
    LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = i.sbi_item_unit_id
    LEFT JOIN LATERAL (SELECT SUM(e.sde_settle_qty) AS settled_qty
                         FROM sales.sale_delivery_event e
                        WHERE e.sde_bill_item_id = i.sbi_id
                          AND e.sde_bill_acc_year = i.sbi_acc_year
                          AND e.sde_is_deleted = false) ev ON true
   WHERE b.sb_company_id::text = 'icompany_id'
     AND b.sb_branch_id::text = 'ibranch_id'
     AND b.sb_is_deleted = false
     AND b.sb_status = 'POSTED'
     AND b.sb_delivery_mode IN ('PICKUP', 'DISPATCH')
     AND b.sb_delivery_status IN ('PENDING', 'PART', 'OUT')
     AND ('imodes' = '' OR b.sb_delivery_mode = ANY (string_to_array('imodes', ',')))
     AND ('icust_id' = '' OR b.sb_cust_id::text = 'icust_id')
     AND ('isalesman_id' = '' OR 'isalesman_id' = ANY (b.sb_salesman_id::text[]))
     AND ('igodown_id' = '' OR i.sbi_godown_id::text = 'igodown_id')
     AND i.sbi_is_deleted = false
     AND i.sbi_is_service = false
     AND COALESCE(i.sbi_src_doc_type, '') <> 'DELIVERY_CHALLAN'
     AND i.sbi_bill_qty > 0
),
ob AS (
  SELECT p.sb_id, p.sb_cust_id, SUM(p.pending_qty * p.unit_kg) AS open_kg
    FROM pl p
   WHERE p.pending_qty <> 0
   GROUP BY p.sb_id, p.sb_acc_year, p.sb_cust_id
),
dl AS (
  SELECT d.sdc_id, d.sdc_cust_id,
         SUM(di.sdi_open_qty * CASE WHEN di.sdi_weight_qty > 0 AND di.sdi_dc_qty > 0 THEN di.sdi_weight_qty / di.sdi_dc_qty
                                    ELSE COALESCE(u.iuc_uom_weight, 0) END) AS open_kg
    FROM sales.sale_dc d
    JOIN sales.sale_dc_item di ON di.sdi_dc_id = d.sdc_id AND di.sdi_acc_year = d.sdc_acc_year
    LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = di.sdi_item_unit_id
   WHERE 'ichallans' = 'true'
     AND d.sdc_company_id::text = 'icompany_id'
     AND d.sdc_branch_id::text = 'ibranch_id'
     AND d.sdc_is_deleted = false
     AND d.sdc_status = 'POSTED'
     AND ('icust_id' = '' OR d.sdc_cust_id::text = 'icust_id')
     AND ('isalesman_id' = '' OR 'isalesman_id' = ANY (d.sdc_salesman_id::text[]))
     AND ('igodown_id' = '' OR di.sdi_godown_id::text = 'igodown_id')
     AND di.sdi_is_deleted = false
     AND di.sdi_open_qty > 0
   GROUP BY d.sdc_id, d.sdc_acc_year, d.sdc_cust_id
),
r AS (
  SELECT 'BILL' AS row_kind, ob.sb_cust_id AS cust_id, ob.open_kg FROM ob
  UNION ALL
  SELECT 'DC', dl.sdc_cust_id, dl.open_kg FROM dl
)
SELECT COALESCE(ct.ctm_id::text, 'NONE') AS city_id,
       COALESCE(ct.ctm_name, '(no city)') AS city_name,
       COALESCE(a.arm_id::text, 'NONE') AS area_id,
       COALESCE(a.arm_name, '(no area)') AS area_name,
       count(*) FILTER (WHERE r.row_kind = 'BILL') AS bill_count,
       round(COALESCE(SUM(r.open_kg) FILTER (WHERE r.row_kind = 'BILL'), 0), 3) AS open_kg,
       round(COALESCE(SUM(r.open_kg) FILTER (WHERE r.row_kind = 'BILL'), 0) / 1000, 2) AS open_ton,
       count(*) FILTER (WHERE r.row_kind = 'DC') AS dc_count,
       round(COALESCE(SUM(r.open_kg) FILTER (WHERE r.row_kind = 'DC'), 0), 3) AS dc_kg,
       min(ct.ctm_order) AS city_sort,
       min(a.arm_sort) AS area_sort
  FROM r
  LEFT JOIN sales.customers c ON c.cus_id = r.cust_id
  LEFT JOIN sales.area_master a ON a.arm_id = c.cus_area_id
  LEFT JOIN sales.city_master ct ON ct.ctm_id = a.arm_city_id
 GROUP BY 1, 2, 3, 4
 ORDER BY min(ct.ctm_order) NULLS LAST, 2, min(a.arm_sort) NULLS LAST, 4$g213$),
(214, 'PENDING DELIVERIES - ITEM-WISE',
 'Pending Deliveries (menu 304) Item-wise tab: one row per item and godown of the open lines: pending in the item''s selling unit (iuc_is_default_unit, else base), bills, kg, oldest days, on shelf (Physical = owned SALEABLE + billed not delivered, base / selling factor) and short (pending above the shelf). Tokens as grid 212: icompany_id, ibranch_id, igodown_id, icust_id, isalesman_id, iarea_ids, imodes.',
 'item_name', 'Ascending', 'Desktop', true, false, 'system',
$g214$WITH op AS (
  SELECT b.sb_id, b.sb_bill_date, b.sb_cust_id, b.sb_salesman_id, b.sb_delivery_mode,
         i.sbi_item_id, i.sbi_godown_id, i.sbi_bucket,
         i.sbi_bill_qty - COALESCE(ev.settled_qty, 0) AS pending_qty,
         CASE WHEN i.sbi_to_base_factor > 0 THEN i.sbi_to_base_factor
              ELSE COALESCE(NULLIF(u.iuc_to_base_factor, 0), 1) END AS base_factor,
         CASE WHEN i.sbi_weight_qty > 0 AND i.sbi_bill_qty > 0 THEN i.sbi_weight_qty / i.sbi_bill_qty
              ELSE COALESCE(u.iuc_uom_weight, 0) END AS unit_kg
    FROM sales.sale_bill b
    JOIN sales.sale_bill_item i ON i.sbi_bill_id = b.sb_id AND i.sbi_acc_year = b.sb_acc_year
    LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = i.sbi_item_unit_id
    LEFT JOIN LATERAL (SELECT SUM(e.sde_settle_qty) AS settled_qty
                         FROM sales.sale_delivery_event e
                        WHERE e.sde_bill_item_id = i.sbi_id
                          AND e.sde_bill_acc_year = i.sbi_acc_year
                          AND e.sde_is_deleted = false) ev ON true
   WHERE b.sb_company_id::text = 'icompany_id'
     AND b.sb_branch_id::text = 'ibranch_id'
     AND b.sb_is_deleted = false
     AND b.sb_status = 'POSTED'
     AND b.sb_delivery_mode IN ('PICKUP', 'DISPATCH')
     AND b.sb_delivery_status IN ('PENDING', 'PART', 'OUT')
     AND i.sbi_is_deleted = false
     AND i.sbi_is_service = false
     AND COALESCE(i.sbi_src_doc_type, '') <> 'DELIVERY_CHALLAN'
     AND i.sbi_bill_qty > 0
     AND i.sbi_bill_qty - COALESCE(ev.settled_qty, 0) <> 0
),
flt AS (
  SELECT o.*
    FROM op o
    LEFT JOIN sales.customers c ON c.cus_id = o.sb_cust_id
   WHERE ('igodown_id' = '' OR o.sbi_godown_id::text = 'igodown_id')
     AND ('imodes' = '' OR o.sb_delivery_mode = ANY (string_to_array('imodes', ',')))
     AND ('icust_id' = '' OR o.sb_cust_id::text = 'icust_id')
     AND ('isalesman_id' = '' OR 'isalesman_id' = ANY (o.sb_salesman_id::text[]))
     AND ('iarea_ids' = '' OR COALESCE(c.cus_area_id::text, 'NONE') = ANY (string_to_array('iarea_ids', ',')))
),
grp AS (
  SELECT f.sbi_item_id, f.sbi_godown_id,
         SUM(f.pending_qty * f.base_factor) AS pending_base,
         count(DISTINCT f.sb_id) AS bill_count,
         SUM(f.pending_qty * f.unit_kg) AS open_kg,
         MAX(CURRENT_DATE - f.sb_bill_date) AS oldest_days
    FROM flt f
   GROUP BY f.sbi_item_id, f.sbi_godown_id
),
bnd AS (
  SELECT o.sbi_item_id, o.sbi_godown_id, SUM(o.pending_qty * o.base_factor) AS bnd_base
    FROM op o
   WHERE o.sbi_bucket = 'SALEABLE'
   GROUP BY o.sbi_item_id, o.sbi_godown_id
),
own AS (
  SELECT s.sbl_item_id, s.sbl_godown_id, SUM(s.sbl_on_hand_qty) AS owned_base
    FROM stock.stock_balance s
   WHERE s.sbl_company_id::text = 'icompany_id'
     AND s.sbl_branch_id::text = 'ibranch_id'
     AND s.sbl_bucket = 'SALEABLE'
     AND s.sbl_is_deleted = false
     AND (s.sbl_item_id, s.sbl_godown_id) IN (SELECT g.sbi_item_id, g.sbi_godown_id FROM grp g)
   GROUP BY s.sbl_item_id, s.sbl_godown_id
)
SELECT g.sbi_item_id AS item_id,
       im.item_code,
       im.item_name_en AS item_name,
       g.sbi_godown_id AS godown_id,
       COALESCE(gd.gdl_name, '') AS godown_name,
       COALESCE(su.unit_name, bu.unit_name, '') AS unit_name,
       COALESCE(dfl.factor, 1) AS sell_factor,
       round(g.pending_base / COALESCE(dfl.factor, 1), 3) AS pending_qty,
       g.bill_count,
       round(g.open_kg, 3) AS open_kg,
       g.oldest_days,
       round((COALESCE(ow.owned_base, 0) + COALESCE(bd.bnd_base, 0)) / COALESCE(dfl.factor, 1), 3) AS on_shelf_qty,
       round(GREATEST(g.pending_base - COALESCE(ow.owned_base, 0) - COALESCE(bd.bnd_base, 0), 0) / COALESCE(dfl.factor, 1), 3) AS short_qty
  FROM grp g
  JOIN inventory.item_master im ON im.item_id = g.sbi_item_id
  LEFT JOIN inventory.godown_locations gd ON gd.gdl_id = g.sbi_godown_id
  LEFT JOIN bnd bd ON bd.sbi_item_id = g.sbi_item_id AND bd.sbi_godown_id = g.sbi_godown_id
  LEFT JOIN own ow ON ow.sbl_item_id = g.sbi_item_id AND ow.sbl_godown_id = g.sbi_godown_id
  LEFT JOIN LATERAL (SELECT COALESCE(NULLIF(x.iuc_to_base_factor, 0), 1) AS factor, x.iuc_unit_id
                       FROM inventory.item_unit_conversion x
                      WHERE x.iuc_item_id = g.sbi_item_id
                        AND x.iuc_is_default_unit = true
                        AND x.iuc_is_deleted = false
                      ORDER BY x.iuc_unit_slno
                      LIMIT 1) dfl ON true
  LEFT JOIN inventory.item_unit_master su ON su.unit_id = dfl.iuc_unit_id
  LEFT JOIN inventory.item_unit_master bu ON bu.unit_id = im.item_base_unit_id
 ORDER BY im.item_name_en, gd.gdl_name$g214$),
(215, 'PENDING DELIVERIES - OPEN LINES',
 'One bill''s eligible lines for Pending Deliveries (menu 304, OPEN LINES pane): billed, given (sum of out), pending (billed - settled), kg, and the last note that gave it (qty, refno, IST time, by). Tokens: icompany_id, ibill_id (sb_id), iacc_year (sb_acc_year).',
 'line_no', 'Ascending', 'Desktop', true, false, 'system',
$g215$SELECT i.sbi_id AS line_id,
       i.sbi_acc_year AS line_acc_year,
       i.sbi_line_no AS line_no,
       i.sbi_item_id AS item_id,
       im.item_code,
       im.item_name_en AS item_name,
       i.sbi_godown_id AS godown_id,
       COALESCE(gd.gdl_name, '') AS godown_name,
       i.sbi_lot_id AS lot_id,
       COALESCE(lt.slt_batch_no, '') AS lot_no,
       COALESCE(um.unit_name, '') AS unit_name,
       i.sbi_bill_qty AS billed_qty,
       COALESCE(ev.given_qty, 0) AS given_qty,
       i.sbi_bill_qty - COALESCE(ev.settled_qty, 0) AS pending_qty,
       round((i.sbi_bill_qty - COALESCE(ev.settled_qty, 0))
             * CASE WHEN i.sbi_weight_qty > 0 AND i.sbi_bill_qty > 0 THEN i.sbi_weight_qty / i.sbi_bill_qty
                    ELSE COALESCE(u.iuc_uom_weight, 0) END, 3) AS pending_kg,
       COALESCE(trim_scale(lg.sde_out_qty) || ' on ' || lg.sde_src_refno || ' · '
                || to_char(lg.sde_event_datetime AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY HH12:MI AM')
                || ' · ' || COALESCE(NULLIF(lu.usr_display_name, ''), lu.usr_login_name, lg.sde_created_by), '') AS given_on,
       lg.sde_src_doc_id AS last_note_id,
       lg.sde_src_acc_year AS last_note_acc_year,
       b.sb_id AS bill_id,
       b.sb_acc_year AS bill_acc_year
  FROM sales.sale_bill b
  JOIN sales.sale_bill_item i ON i.sbi_bill_id = b.sb_id AND i.sbi_acc_year = b.sb_acc_year
  JOIN inventory.item_master im ON im.item_id = i.sbi_item_id
  LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = i.sbi_item_unit_id
  LEFT JOIN inventory.item_unit_master um ON um.unit_id = u.iuc_unit_id
  LEFT JOIN inventory.godown_locations gd ON gd.gdl_id = i.sbi_godown_id
  LEFT JOIN stock.stock_lot lt ON lt.slt_id = i.sbi_lot_id
  LEFT JOIN LATERAL (SELECT SUM(e.sde_settle_qty) AS settled_qty, SUM(e.sde_out_qty) AS given_qty
                       FROM sales.sale_delivery_event e
                      WHERE e.sde_bill_item_id = i.sbi_id
                        AND e.sde_bill_acc_year = i.sbi_acc_year
                        AND e.sde_is_deleted = false) ev ON true
  LEFT JOIN LATERAL (SELECT e.sde_out_qty, e.sde_src_refno, e.sde_event_datetime, e.sde_created_by,
                            e.sde_src_doc_id, e.sde_src_acc_year
                       FROM sales.sale_delivery_event e
                      WHERE e.sde_bill_item_id = i.sbi_id
                        AND e.sde_bill_acc_year = i.sbi_acc_year
                        AND e.sde_kind = 'GIVEN'
                        AND e.sde_is_deleted = false
                        AND NOT EXISTS (SELECT 1 FROM sales.sale_delivery_event x
                                         WHERE x.sde_reverses_id = e.sde_id
                                           AND x.sde_kind = 'CANCEL')
                      ORDER BY e.sde_event_datetime DESC, e.sde_created_on DESC
                      LIMIT 1) lg ON true
  LEFT JOIN public.user_master lu ON lu.usr_id::text = lg.sde_created_by
 WHERE b.sb_company_id::text = 'icompany_id'
   AND b.sb_id::text = 'ibill_id'
   AND b.sb_acc_year = 'iacc_year'
   AND b.sb_is_deleted = false
   AND b.sb_status = 'POSTED'
   AND b.sb_delivery_mode IN ('PICKUP', 'DISPATCH')
   AND i.sbi_is_deleted = false
   AND i.sbi_is_service = false
   AND COALESCE(i.sbi_src_doc_type, '') <> 'DELIVERY_CHALLAN'
   AND i.sbi_bill_qty > 0
 ORDER BY i.sbi_line_no$g215$),
(216, 'MAIN LIST - DELIVERY NOTES',
 'Delivery Note list (menu 305, TxnMainView). Tokens (send every one; '''' = no bound / all): icompany_id, ibranch_id, ifrom_date, ito_date (yyyy-MM-dd, on sdn_date), igodown_id, istatus ('''' / DRAFT / POSTED / CANCELLED). Newest first.',
 'sdn_date', 'Descending', 'Desktop', true, false, 'system',
$g216$SELECT n.sdn_id,
       n.sdn_company_id,
       n.sdn_branch_id,
       n.sdn_acc_year,
       n.sdn_refno,
       n.sdn_date,
       COALESCE(g.gdl_name, '') AS godown_name,
       CASE n.sdn_mode WHEN 'SELF' THEN 'Self pickup'
                       WHEN 'VEHICLE' THEN 'Vehicle'
                       WHEN 'TRANSPORTER' THEN 'Transporter'
                       ELSE n.sdn_mode END AS sdn_mode_text,
       CASE n.sdn_mode WHEN 'SELF' THEN COALESCE(n.sdn_collected_by, '')
                       WHEN 'TRANSPORTER' THEN COALESCE(t.ttd_transporter_name, '')
                       ELSE COALESCE(NULLIF(n.sdn_vehicle_no, ''), v.veh_vehicle_no, '') END AS sdn_vehicle_text,
       n.sdn_bill_count,
       n.sdn_tot_lines,
       n.sdn_tot_qty,
       n.sdn_tot_weight_kg,
       n.sdn_status,
       n.sdn_print_count,
       COALESCE(NULLIF(u.usr_display_name, ''), u.usr_login_name, n.sdn_created_by) AS sdn_created_by_name,
       CASE WHEN n.sdn_posted_on IS NULL THEN ''
            ELSE to_char(n.sdn_posted_on AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY HH12:MI AM') END AS sdn_posted_at,
       n.sdn_mode,
       n.sdn_godown_id,
       n.sdn_device_id,
       n.sdn_slno
  FROM sales.sale_delivery_note n
  LEFT JOIN inventory.godown_locations g ON g.gdl_id = n.sdn_godown_id
  LEFT JOIN public.vehicle_master v ON v.veh_id = n.sdn_vehicle_id
  LEFT JOIN public.txn_transport_detail t ON t.ttd_doc_type = 'DELIVERY_NOTE'
                                         AND t.ttd_doc_id = n.sdn_id
                                         AND t.ttd_acc_year = n.sdn_acc_year
                                         AND t.ttd_is_deleted = false
  LEFT JOIN public.user_master u ON u.usr_id::text = n.sdn_created_by
 WHERE n.sdn_company_id::text = 'icompany_id'
   AND n.sdn_branch_id::text = 'ibranch_id'
   AND n.sdn_is_deleted = false
   AND (NULLIF('ifrom_date', '') IS NULL OR n.sdn_date::text >= 'ifrom_date')
   AND (NULLIF('ito_date', '') IS NULL OR n.sdn_date::text <= 'ito_date')
   AND ('igodown_id' = '' OR n.sdn_godown_id::text = 'igodown_id')
   AND ('istatus' = '' OR n.sdn_status = 'istatus')
 ORDER BY n.sdn_date DESC, n.sdn_created_on DESC$g216$),
(217, 'POPUP - DELIVERY NOTE PENDINGS',
 'Delivery Note (menu 305) F4: the bills with something still to give from ONE godown: lines, packages and kg here, and what waits in other godowns. Tokens: icompany_id, ibranch_id, igodown_id (required).',
 'sb_bill_date', 'Ascending', 'Desktop', true, false, 'system',
$g217$WITH op AS (
  SELECT b.sb_id, b.sb_acc_year, i.sbi_godown_id,
         (i.sbi_godown_id::text = 'igodown_id') AS is_here,
         i.sbi_bill_qty - COALESCE(ev.settled_qty, 0) AS pending_qty,
         CASE WHEN i.sbi_weight_qty > 0 AND i.sbi_bill_qty > 0 THEN i.sbi_weight_qty / i.sbi_bill_qty
              ELSE COALESCE(u.iuc_uom_weight, 0) END AS unit_kg
    FROM sales.sale_bill b
    JOIN sales.sale_bill_item i ON i.sbi_bill_id = b.sb_id AND i.sbi_acc_year = b.sb_acc_year
    LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = i.sbi_item_unit_id
    LEFT JOIN LATERAL (SELECT SUM(e.sde_settle_qty) AS settled_qty
                         FROM sales.sale_delivery_event e
                        WHERE e.sde_bill_item_id = i.sbi_id
                          AND e.sde_bill_acc_year = i.sbi_acc_year
                          AND e.sde_is_deleted = false) ev ON true
   WHERE b.sb_company_id::text = 'icompany_id'
     AND b.sb_branch_id::text = 'ibranch_id'
     AND b.sb_is_deleted = false
     AND b.sb_status = 'POSTED'
     AND b.sb_delivery_mode IN ('PICKUP', 'DISPATCH')
     AND b.sb_delivery_status IN ('PENDING', 'PART', 'OUT')
     AND i.sbi_is_deleted = false
     AND i.sbi_is_service = false
     AND COALESCE(i.sbi_src_doc_type, '') <> 'DELIVERY_CHALLAN'
     AND i.sbi_bill_qty > 0
     AND i.sbi_bill_qty - COALESCE(ev.settled_qty, 0) > 0
),
ob AS (
  SELECT o.sb_id, o.sb_acc_year,
         count(*) FILTER (WHERE o.is_here) AS lines_here,
         SUM(o.pending_qty) FILTER (WHERE o.is_here) AS pkgs_here,
         SUM(o.pending_qty * o.unit_kg) FILTER (WHERE o.is_here) AS kg_here,
         count(*) FILTER (WHERE NOT o.is_here) AS lines_elsewhere,
         string_agg(DISTINCT g.gdl_name, ', ') FILTER (WHERE NOT o.is_here) AS godowns_elsewhere
    FROM op o
    LEFT JOIN inventory.godown_locations g ON g.gdl_id = o.sbi_godown_id
   GROUP BY o.sb_id, o.sb_acc_year
  HAVING count(*) FILTER (WHERE o.is_here) > 0
)
SELECT b.sb_id,
       b.sb_acc_year,
       b.sb_bill_refno,
       b.sb_bill_date,
       (CURRENT_DATE - b.sb_bill_date) AS days_old,
       b.sb_cust_id,
       COALESCE(c.cus_name, b.sb_cust_name) AS cust_name,
       COALESCE(a.arm_name, '(no area)') AS area_name,
       b.sb_delivery_mode,
       b.sb_delivery_status,
       ob.lines_here,
       round(ob.pkgs_here, 3) AS pkgs_here,
       round(COALESCE(ob.kg_here, 0), 3) AS kg_here,
       ob.lines_elsewhere,
       CASE WHEN ob.lines_elsewhere = 0 THEN ''
            WHEN ob.lines_elsewhere = 1 THEN '1 line in ' || ob.godowns_elsewhere
            ELSE ob.lines_elsewhere || ' lines in ' || ob.godowns_elsewhere END AS elsewhere_text
  FROM ob
  JOIN sales.sale_bill b ON b.sb_id = ob.sb_id AND b.sb_acc_year = ob.sb_acc_year
  LEFT JOIN sales.customers c ON c.cus_id = b.sb_cust_id
  LEFT JOIN sales.area_master a ON a.arm_id = c.cus_area_id
 ORDER BY b.sb_bill_date, b.sb_bill_refno$g217$),
(218, 'POPUP - BILL DELIVERIES',
 'One bill''s delivery events (the Sale Bill''s DELIVERY chip): when (IST, 12-hour), what, the note or return, line, item, qty settled and qty out of the godown, unit, godown, lot, by, reason. Tokens: icompany_id, ibill_id (sb_id), iacc_year (sb_acc_year).',
 'event_sort', 'Ascending', 'Desktop', true, false, 'system',
$g218$SELECT e.sde_id,
       e.sde_acc_year,
       to_char(e.sde_event_datetime AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY HH12:MI AM') AS event_at,
       e.sde_kind,
       CASE e.sde_kind WHEN 'GIVEN' THEN 'Given'
                       WHEN 'CANCEL' THEN 'Note cancelled'
                       WHEN 'GOODS_BACK' THEN 'Goods back'
                       WHEN 'RETURN' THEN 'Returned, never taken'
                       WHEN 'RETURN_CANCEL' THEN 'Return cancelled'
                       WHEN 'CLEANUP' THEN 'Marked delivered at go-live'
                       ELSE e.sde_kind END AS kind_text,
       COALESCE(e.sde_src_refno, '') AS src_refno,
       e.sde_src_doc_type,
       e.sde_src_doc_id,
       e.sde_src_acc_year,
       e.sde_bill_line_no AS line_no,
       im.item_name_en AS item_name,
       e.sde_settle_qty AS qty,
       e.sde_out_qty AS out_qty,
       COALESCE(um.unit_name, '') AS unit_name,
       COALESCE(gd.gdl_name, '') AS godown_name,
       COALESCE(lt.slt_batch_no, '') AS lot_no,
       COALESCE(NULLIF(u.usr_display_name, ''), u.usr_login_name, e.sde_created_by) AS by_name,
       COALESCE(e.sde_reason, '') AS reason,
       e.sde_bill_item_id,
       to_char(e.sde_event_datetime AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI:SS') AS event_sort
  FROM sales.sale_delivery_event e
  JOIN sales.sale_bill_item i ON i.sbi_id = e.sde_bill_item_id AND i.sbi_acc_year = e.sde_bill_acc_year
  JOIN inventory.item_master im ON im.item_id = e.sde_item_id
  LEFT JOIN inventory.item_unit_conversion iu ON iu.iuc_id = i.sbi_item_unit_id
  LEFT JOIN inventory.item_unit_master um ON um.unit_id = iu.iuc_unit_id
  LEFT JOIN inventory.godown_locations gd ON gd.gdl_id = e.sde_godown_id
  LEFT JOIN stock.stock_lot lt ON lt.slt_id = e.sde_lot_id
  LEFT JOIN public.user_master u ON u.usr_id::text = e.sde_created_by
 WHERE e.sde_company_id::text = 'icompany_id'
   AND e.sde_bill_id::text = 'ibill_id'
   AND e.sde_bill_acc_year = 'iacc_year'
   AND e.sde_is_deleted = false
 ORDER BY e.sde_event_datetime, e.sde_created_on, e.sde_bill_line_no$g218$)
ON CONFLICT (grid_id) DO NOTHING;

INSERT INTO fixed.grid_columns
       (grid_column_id, grid_id, grid_column_number, grid_column_name, grid_column_sql_field_name,
        grid_column_data_type, grid_column_width, grid_column_position, grid_column_alignment,
        grid_column_visibility, grid_column_filter, grid_column_group, grid_column_total,
        grid_column_notes, grid_column_is_deleted, grid_column_created_by)
SELECT v.id, v.grid, v.no, v.name, v.fld, v.typ, v.width, v.no, v.align, v.visible, v.filter,
       false, false, v.fld, false, 'system'
  FROM (VALUES
    -- 212 MAIN LIST - PENDING DELIVERIES
    ('01a1e1d0-2120-7000-8000-000000212001'::uuid, 212::bigint, 1::integer, 'Kind'::text, 'row_kind'::text, 'Text'::text, 0.00::numeric, 'Left'::text, false::boolean, false::boolean),
    ('01a1e1d0-2120-7000-8000-000000212002', 212, 2, '#', 'doc_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2120-7000-8000-000000212003', 212, 3, 'Year', 'doc_acc_year', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2120-7000-8000-000000212004', 212, 4, 'Company', 'company_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2120-7000-8000-000000212005', 212, 5, 'Branch', 'branch_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2120-7000-8000-000000212006', 212, 6, 'Bill no', 'doc_refno', 'Text', 10.00, 'Left', true, true),
    ('01a1e1d0-2120-7000-8000-000000212007', 212, 7, 'Date', 'doc_date', 'Date', 7.00, 'Left', true, false),
    ('01a1e1d0-2120-7000-8000-000000212008', 212, 8, 'Days', 'days_old', 'Number', 4.00, 'Right', true, false),
    ('01a1e1d0-2120-7000-8000-000000212009', 212, 9, 'Age band', 'age_band', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2120-7000-8000-000000212010', 212, 10, 'Customer id', 'cust_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2120-7000-8000-000000212011', 212, 11, 'Customer', 'cust_name', 'Text', 13.00, 'Left', true, true),
    ('01a1e1d0-2120-7000-8000-000000212012', 212, 12, 'Area id', 'area_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2120-7000-8000-000000212013', 212, 13, 'Area', 'area_name', 'Text', 8.00, 'Left', true, true),
    ('01a1e1d0-2120-7000-8000-000000212014', 212, 14, 'City', 'city_name', 'Text', 0.00, 'Left', false, true),
    ('01a1e1d0-2120-7000-8000-000000212015', 212, 15, 'Salesman', 'salesman_names', 'Text', 6.00, 'Left', true, true),
    ('01a1e1d0-2120-7000-8000-000000212016', 212, 16, 'Mode', 'delivery_mode', 'Text', 7.00, 'Center', true, false),
    ('01a1e1d0-2120-7000-8000-000000212017', 212, 17, 'Status', 'delivery_status', 'Text', 8.00, 'Center', true, false),
    ('01a1e1d0-2120-7000-8000-000000212018', 212, 18, 'Godowns', 'godown_names', 'Text', 10.00, 'Left', true, true),
    ('01a1e1d0-2120-7000-8000-000000212019', 212, 19, 'Godown count', 'godown_count', 'Number', 0.00, 'Right', false, false),
    ('01a1e1d0-2120-7000-8000-000000212020', 212, 20, 'Lines', 'open_lines', 'Number', 4.00, 'Right', true, false),
    ('01a1e1d0-2120-7000-8000-000000212021', 212, 21, 'Pkgs', 'open_pkgs', 'Number', 4.00, 'Right', true, false),
    ('01a1e1d0-2120-7000-8000-000000212022', 212, 22, 'Kg', 'open_kg', 'Number', 6.00, 'Right', true, false),
    ('01a1e1d0-2120-7000-8000-000000212023', 212, 23, 'Last given', 'last_given', 'Text', 13.00, 'Left', true, false),
    ('01a1e1d0-2120-7000-8000-000000212024', 212, 24, 'Last note', 'last_note_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2120-7000-8000-000000212025', 212, 25, 'Last note year', 'last_note_acc_year', 'Text', 0.00, 'Left', false, false),
    -- 213 PENDING DELIVERIES - BEATS
    ('01a1e1d0-2130-7000-8000-000000213001', 213, 1, 'City id', 'city_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2130-7000-8000-000000213002', 213, 2, 'City', 'city_name', 'Text', 35.00, 'Left', true, true),
    ('01a1e1d0-2130-7000-8000-000000213003', 213, 3, 'Area id', 'area_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2130-7000-8000-000000213004', 213, 4, 'Area', 'area_name', 'Text', 35.00, 'Left', true, true),
    ('01a1e1d0-2130-7000-8000-000000213005', 213, 5, 'Bills', 'bill_count', 'Number', 10.00, 'Right', true, false),
    ('01a1e1d0-2130-7000-8000-000000213006', 213, 6, 'Kg', 'open_kg', 'Number', 0.00, 'Right', false, false),
    ('01a1e1d0-2130-7000-8000-000000213007', 213, 7, 'Ton', 'open_ton', 'Number', 10.00, 'Right', true, false),
    ('01a1e1d0-2130-7000-8000-000000213008', 213, 8, 'Challans', 'dc_count', 'Number', 10.00, 'Right', true, false),
    ('01a1e1d0-2130-7000-8000-000000213009', 213, 9, 'Challan kg', 'dc_kg', 'Number', 0.00, 'Right', false, false),
    ('01a1e1d0-2130-7000-8000-000000213010', 213, 10, 'City sort', 'city_sort', 'Number', 0.00, 'Right', false, false),
    ('01a1e1d0-2130-7000-8000-000000213011', 213, 11, 'Area sort', 'area_sort', 'Number', 0.00, 'Right', false, false),
    -- 214 PENDING DELIVERIES - ITEM-WISE
    ('01a1e1d0-2140-7000-8000-000000214001', 214, 1, 'Item id', 'item_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2140-7000-8000-000000214002', 214, 2, 'Code', 'item_code', 'Text', 8.00, 'Left', true, true),
    ('01a1e1d0-2140-7000-8000-000000214003', 214, 3, 'Item', 'item_name', 'Text', 28.00, 'Left', true, true),
    ('01a1e1d0-2140-7000-8000-000000214004', 214, 4, 'Godown id', 'godown_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2140-7000-8000-000000214005', 214, 5, 'Godown', 'godown_name', 'Text', 10.00, 'Left', true, true),
    ('01a1e1d0-2140-7000-8000-000000214006', 214, 6, 'Unit', 'unit_name', 'Text', 5.00, 'Left', true, false),
    ('01a1e1d0-2140-7000-8000-000000214007', 214, 7, 'Selling factor', 'sell_factor', 'Number', 0.00, 'Right', false, false),
    ('01a1e1d0-2140-7000-8000-000000214008', 214, 8, 'Pending', 'pending_qty', 'Number', 9.00, 'Right', true, false),
    ('01a1e1d0-2140-7000-8000-000000214009', 214, 9, 'Bills', 'bill_count', 'Number', 6.00, 'Right', true, false),
    ('01a1e1d0-2140-7000-8000-000000214010', 214, 10, 'Kg', 'open_kg', 'Number', 9.00, 'Right', true, false),
    ('01a1e1d0-2140-7000-8000-000000214011', 214, 11, 'Oldest', 'oldest_days', 'Number', 7.00, 'Right', true, false),
    ('01a1e1d0-2140-7000-8000-000000214012', 214, 12, 'On shelf', 'on_shelf_qty', 'Number', 9.00, 'Right', true, false),
    ('01a1e1d0-2140-7000-8000-000000214013', 214, 13, 'Short', 'short_qty', 'Number', 9.00, 'Right', true, false),
    -- 215 PENDING DELIVERIES - OPEN LINES
    ('01a1e1d0-2150-7000-8000-000000215001', 215, 1, 'Line id', 'line_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2150-7000-8000-000000215002', 215, 2, 'Line year', 'line_acc_year', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2150-7000-8000-000000215003', 215, 3, '#', 'line_no', 'Number', 3.00, 'Right', true, false),
    ('01a1e1d0-2150-7000-8000-000000215004', 215, 4, 'Item id', 'item_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2150-7000-8000-000000215005', 215, 5, 'Code', 'item_code', 'Text', 0.00, 'Left', false, true),
    ('01a1e1d0-2150-7000-8000-000000215006', 215, 6, 'Item', 'item_name', 'Text', 28.00, 'Left', true, true),
    ('01a1e1d0-2150-7000-8000-000000215007', 215, 7, 'Godown id', 'godown_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2150-7000-8000-000000215008', 215, 8, 'Godown', 'godown_name', 'Text', 9.00, 'Left', true, false),
    ('01a1e1d0-2150-7000-8000-000000215009', 215, 9, 'Lot id', 'lot_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2150-7000-8000-000000215010', 215, 10, 'Lot', 'lot_no', 'Text', 8.00, 'Left', true, false),
    ('01a1e1d0-2150-7000-8000-000000215011', 215, 11, 'Unit', 'unit_name', 'Text', 4.00, 'Left', true, false),
    ('01a1e1d0-2150-7000-8000-000000215012', 215, 12, 'Billed', 'billed_qty', 'Number', 6.00, 'Right', true, false),
    ('01a1e1d0-2150-7000-8000-000000215013', 215, 13, 'Given', 'given_qty', 'Number', 6.00, 'Right', true, false),
    ('01a1e1d0-2150-7000-8000-000000215014', 215, 14, 'Pending', 'pending_qty', 'Number', 7.00, 'Right', true, false),
    ('01a1e1d0-2150-7000-8000-000000215015', 215, 15, 'Kg', 'pending_kg', 'Number', 7.00, 'Right', true, false),
    ('01a1e1d0-2150-7000-8000-000000215016', 215, 16, 'Given on', 'given_on', 'Text', 22.00, 'Left', true, false),
    ('01a1e1d0-2150-7000-8000-000000215017', 215, 17, 'Last note', 'last_note_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2150-7000-8000-000000215018', 215, 18, 'Last note year', 'last_note_acc_year', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2150-7000-8000-000000215019', 215, 19, 'Bill id', 'bill_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2150-7000-8000-000000215020', 215, 20, 'Bill year', 'bill_acc_year', 'Text', 0.00, 'Left', false, false),
    -- 216 MAIN LIST - DELIVERY NOTES
    ('01a1e1d0-2160-7000-8000-000000216001', 216, 1, '#', 'sdn_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2160-7000-8000-000000216002', 216, 2, 'Company', 'sdn_company_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2160-7000-8000-000000216003', 216, 3, 'Branch', 'sdn_branch_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2160-7000-8000-000000216004', 216, 4, 'Year', 'sdn_acc_year', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2160-7000-8000-000000216005', 216, 5, 'Note No', 'sdn_refno', 'Text', 14.00, 'Left', true, true),
    ('01a1e1d0-2160-7000-8000-000000216006', 216, 6, 'Date', 'sdn_date', 'Date', 8.00, 'Left', true, false),
    ('01a1e1d0-2160-7000-8000-000000216007', 216, 7, 'Godown', 'godown_name', 'Text', 10.00, 'Left', true, true),
    ('01a1e1d0-2160-7000-8000-000000216008', 216, 8, 'Mode', 'sdn_mode_text', 'Text', 8.00, 'Left', true, false),
    ('01a1e1d0-2160-7000-8000-000000216009', 216, 9, 'Vehicle / collected by', 'sdn_vehicle_text', 'Text', 12.00, 'Left', true, true),
    ('01a1e1d0-2160-7000-8000-000000216010', 216, 10, 'Bills', 'sdn_bill_count', 'Number', 5.00, 'Right', true, false),
    ('01a1e1d0-2160-7000-8000-000000216011', 216, 11, 'Lines', 'sdn_tot_lines', 'Number', 5.00, 'Right', true, false),
    ('01a1e1d0-2160-7000-8000-000000216012', 216, 12, 'Pkgs', 'sdn_tot_qty', 'Number', 6.00, 'Right', true, false),
    ('01a1e1d0-2160-7000-8000-000000216013', 216, 13, 'Kg', 'sdn_tot_weight_kg', 'Number', 7.00, 'Right', true, false),
    ('01a1e1d0-2160-7000-8000-000000216014', 216, 14, 'Status', 'sdn_status', 'Text', 8.00, 'Center', true, false),
    ('01a1e1d0-2160-7000-8000-000000216015', 216, 15, 'Prints', 'sdn_print_count', 'Number', 4.00, 'Center', true, false),
    ('01a1e1d0-2160-7000-8000-000000216016', 216, 16, 'By', 'sdn_created_by_name', 'Text', 13.00, 'Left', true, false),
    ('01a1e1d0-2160-7000-8000-000000216017', 216, 17, 'Posted at', 'sdn_posted_at', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2160-7000-8000-000000216018', 216, 18, 'Mode code', 'sdn_mode', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2160-7000-8000-000000216019', 216, 19, 'Godown id', 'sdn_godown_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2160-7000-8000-000000216020', 216, 20, 'Device', 'sdn_device_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2160-7000-8000-000000216021', 216, 21, 'Slno', 'sdn_slno', 'Number', 0.00, 'Right', false, false),
    -- 217 POPUP - DELIVERY NOTE PENDINGS
    ('01a1e1d0-2170-7000-8000-000000217001', 217, 1, '#', 'sb_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2170-7000-8000-000000217002', 217, 2, 'Year', 'sb_acc_year', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2170-7000-8000-000000217003', 217, 3, 'Bill no', 'sb_bill_refno', 'Text', 15.00, 'Left', true, true),
    ('01a1e1d0-2170-7000-8000-000000217004', 217, 4, 'Date', 'sb_bill_date', 'Date', 12.00, 'Left', true, false),
    ('01a1e1d0-2170-7000-8000-000000217005', 217, 5, 'Days', 'days_old', 'Number', 5.00, 'Right', true, false),
    ('01a1e1d0-2170-7000-8000-000000217006', 217, 6, 'Customer id', 'sb_cust_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2170-7000-8000-000000217007', 217, 7, 'Customer', 'cust_name', 'Text', 17.00, 'Left', true, true),
    ('01a1e1d0-2170-7000-8000-000000217008', 217, 8, 'Area', 'area_name', 'Text', 11.00, 'Left', true, true),
    ('01a1e1d0-2170-7000-8000-000000217009', 217, 9, 'Mode', 'sb_delivery_mode', 'Text', 10.00, 'Center', true, false),
    ('01a1e1d0-2170-7000-8000-000000217010', 217, 10, 'Status', 'sb_delivery_status', 'Text', 0.00, 'Center', false, false),
    ('01a1e1d0-2170-7000-8000-000000217011', 217, 11, 'Lines here', 'lines_here', 'Number', 9.00, 'Right', true, false),
    ('01a1e1d0-2170-7000-8000-000000217012', 217, 12, 'Pkgs here', 'pkgs_here', 'Number', 0.00, 'Right', false, false),
    ('01a1e1d0-2170-7000-8000-000000217013', 217, 13, 'Kg here', 'kg_here', 'Number', 9.00, 'Right', true, false),
    ('01a1e1d0-2170-7000-8000-000000217014', 217, 14, 'Lines elsewhere', 'lines_elsewhere', 'Number', 0.00, 'Right', false, false),
    ('01a1e1d0-2170-7000-8000-000000217015', 217, 15, 'Elsewhere', 'elsewhere_text', 'Text', 12.00, 'Left', true, false),
    -- 218 POPUP - BILL DELIVERIES
    ('01a1e1d0-2180-7000-8000-000000218001', 218, 1, '#', 'sde_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2180-7000-8000-000000218002', 218, 2, 'Year', 'sde_acc_year', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2180-7000-8000-000000218003', 218, 3, 'When', 'event_at', 'Text', 13.00, 'Left', true, false),
    ('01a1e1d0-2180-7000-8000-000000218004', 218, 4, 'Kind', 'sde_kind', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2180-7000-8000-000000218005', 218, 5, 'What', 'kind_text', 'Text', 12.00, 'Left', true, true),
    ('01a1e1d0-2180-7000-8000-000000218006', 218, 6, 'Note / return', 'src_refno', 'Text', 14.00, 'Left', true, true),
    ('01a1e1d0-2180-7000-8000-000000218007', 218, 7, 'Source type', 'sde_src_doc_type', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2180-7000-8000-000000218008', 218, 8, 'Source id', 'sde_src_doc_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2180-7000-8000-000000218009', 218, 9, 'Source year', 'sde_src_acc_year', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2180-7000-8000-000000218010', 218, 10, 'Line', 'line_no', 'Number', 4.00, 'Right', true, false),
    ('01a1e1d0-2180-7000-8000-000000218011', 218, 11, 'Item', 'item_name', 'Text', 18.00, 'Left', true, true),
    ('01a1e1d0-2180-7000-8000-000000218012', 218, 12, 'Qty', 'qty', 'Number', 6.00, 'Right', true, false),
    ('01a1e1d0-2180-7000-8000-000000218013', 218, 13, 'Out qty', 'out_qty', 'Number', 0.00, 'Right', false, false),
    ('01a1e1d0-2180-7000-8000-000000218014', 218, 14, 'Unit', 'unit_name', 'Text', 4.00, 'Left', true, false),
    ('01a1e1d0-2180-7000-8000-000000218015', 218, 15, 'Godown', 'godown_name', 'Text', 8.00, 'Left', true, false),
    ('01a1e1d0-2180-7000-8000-000000218016', 218, 16, 'Lot', 'lot_no', 'Text', 6.00, 'Left', true, false),
    ('01a1e1d0-2180-7000-8000-000000218017', 218, 17, 'By', 'by_name', 'Text', 8.00, 'Left', true, false),
    ('01a1e1d0-2180-7000-8000-000000218018', 218, 18, 'Reason', 'reason', 'Text', 7.00, 'Left', true, false),
    ('01a1e1d0-2180-7000-8000-000000218019', 218, 19, 'Bill line id', 'sde_bill_item_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2180-7000-8000-000000218020', 218, 20, 'Sort', 'event_sort', 'Text', 0.00, 'Left', false, false)
       ) v(id, grid, no, name, fld, typ, width, align, visible, filter)
 WHERE EXISTS (SELECT 1 FROM fixed.grid_details d
                WHERE d.grid_id = v.grid
                  AND d.grid_name IN ('MAIN LIST - PENDING DELIVERIES', 'PENDING DELIVERIES - BEATS',
                                      'PENDING DELIVERIES - ITEM-WISE', 'PENDING DELIVERIES - OPEN LINES',
                                      'MAIN LIST - DELIVERY NOTES', 'POPUP - DELIVERY NOTE PENDINGS',
                                      'POPUP - BILL DELIVERIES'))
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns e
                    WHERE e.grid_id = v.grid AND e.grid_column_number = v.no AND e.grid_column_is_deleted = false)
ON CONFLICT (grid_column_id) DO NOTHING;

-- Keep the identity sequence ahead of the seeded ids.
SELECT setval(
    pg_get_serial_sequence('fixed.grid_details', 'grid_id'),
    (SELECT GREATEST(COALESCE(MAX(grid_id), 0), 1) FROM fixed.grid_details),
    true
);

COMMIT;
