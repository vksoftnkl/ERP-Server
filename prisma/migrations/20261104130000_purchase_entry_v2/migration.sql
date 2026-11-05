-- ═══════════════════════════════════════════════════════════════════════════
--  Purchase Entry v2 (Purchase Invoice, menu 24), the user's 2026-11-04 list
--  (Shared/Prathap/purchase/plan-purchase-entry-list-2026-11-04.md §3, wave W1a;
--  decisions D1-D27, all recommendations approved by the user 2026-11-04).
--
--  No new table, no function, no trigger. Sorts after
--  20261104100000_branch_serial_numbering and 20261104120000_po_return_mainwindow_1104.
--
--  1. purchase.pur_invoice_item (LIST-partitioned by pii_acc_year: the ALTER on the
--     parent reaches every partition, and a partition created later inherits it):
--        pii_wastage_per_qty numeric(18,6) NOT NULL DEFAULT 0
--            wastage per 1 billed unit, typed or the item default (D10/D11);
--            0.100 = 100 g per kg. Our own normal loss: no claim, never in stock,
--            raises the unit cost, full ITC (D24).
--        pii_wastage_qty     numeric(18,6) NOT NULL DEFAULT 0
--            billed x per-qty, rounded to the unit's decimals by the server.
--        pii_src_qty         numeric(18,6) NULL
--        pii_src_rate        numeric(18,6) NULL
--            the PO / GRN line's qty and rate SNAPSHOT at save (D16), so a later
--            PO amendment does not change an old bill. NULL = a direct line.
--     CHECK ck_pii_wastage: 0 <= per-qty < 1 and wastage qty >= 0. Row-local, so
--     two offline branches can never both break it. The cross-field rule
--     (received + damaged + wastage <= billed) is the server's (PUR_WASTAGE_INVALID).
--     Existing rows read 0 / 0 / NULL / NULL = today's behaviour (D1). A constant
--     default is metadata only: no table rewrite.
--  2. public.transporter_master (D21 / D27): UNIQUE ux_trn_name (company,
--     lower(name)) NULLS NOT DISTINCT WHERE not deleted becomes the plain index
--     ix_trn_name on the same key. Two offline branches may both add "KPN Parcel";
--     the online duplicate check is the service's (TRN_NAME_TAKEN). 0 rows today.
--  3. Menus (D27): the Transport module goes again: 8 "&8 Transport" and its
--     children 126 Tripsheet, 127 Header Types, 128 Vehicle Renewals, 132 Fuel
--     Log, 133 Service Log, 134 Tyre Maintenance, 135 Service Reminders, 136
--     Reports become menu_is_active = false + menu_visiblity = false (rows and
--     grants are kept, so a Transport plan can switch them back on). A row is
--     touched only when its id, parent and name all match. 129 Sales Categories,
--     130 Freight Charges and 131 Cashier Screen sit inside the id range 126-136
--     but are not Transport menus: not touched. 149 Transporters (Purchase >
--     Purchase Masters) is kept: active and visible. prisma/seed/Menu_Master.sql
--     carries the same values (the boot seed inserts ON CONFLICT DO NOTHING, so it
--     never undoes this on a live database).
--  4. public.app_setting_def purchase.allow_posted_amend (D13): BOOL, default
--     true, COMPANY scope, PURCHASE / Posting. Gates POST /purchase/invoices/amend
--     (409 PUR_AMEND_OFF).
--  5. ui_table 56 PURCHASE INVOICE - LINES: + 54..61 at the Qt enum numbers
--     (PurchaseInvoiceCols, appended after ChrgAfterTax = 53; nothing renumbered):
--        54 Remarks "Remarks"            58 SrcRate "PO / GRN rate"
--        55 Weight "Weight" (hidden)     59 Decimals "Decimals" (hidden, technical)
--        56 Stock "Stock"                60 WastagePerQty "Wastage / qty"
--        57 SrcQty "PO / GRN qty"        61 WastageQty "Wastage"
--     47 HSN turns visible; 6 Recd, 7 Dmg, 8 Short stay visible (D5). Every row is
--     re-ranked to the plan's order (§3.2):
--        Barcode Item HSN Unit [Model Size Colour] Batch Expiry Stock PO/GRN-qty
--        Billed Recd Dmg Short Wastage/qty Wastage Free Weight PO/GRN-rate Rate |
--        Disc % Disc Sch % Sch Extra disc | Chrg before tax | Taxable GST% ITC Tax
--        Chrg after tax | Total | Cost w/o Cost incl. | MRP MSP Markup A Sell A ..
--        Markup D Sell D | Check | Remarks | PO / GRN ref, then the technical ones.
--     Visibility is set only where the plan states it; Model / Size / Colour
--     (stock.auto_batch_no) and MRP .. Sell D (price policy) keep the site's own.
--     Existing widths stay; new ones are like their neighbours. Ids are pinned
--     (2318-2325) behind a guard that refuses an id held by another row, and
--     prisma/seed/Ui_Table_Columns.sql carries the same rows. The re-rank runs
--     only while 54 is absent, so a re-run never fights a layout saved later.
--     ui_table 56 is seeded, so on a fresh database every statement here no-ops
--     (guarded on its parent) and the seed lays it out.
--  6. Grid 'POPUP - ITEM PURCHASE HISTORY' (199 where free; COM-04 / D15): the
--     last 50 POSTED bill lines of an item, newest first. Tokens, every one always
--     sent ('' = all): icompany_id, iitem_id, isupplier_id, ibranch_id. Columns
--     are not aliased (TxnDocKey reads pi_id / pi_company_id / pi_branch_id /
--     pi_acc_year).
--     Grid 'MAIN LIST - TRANSPORTERS' (200 where free; TRN-01, menu 149) over
--     public.transporter_master. Tokens icompany_id, iinactive ('true' shows
--     switched-off ones), grid 194's pattern. Shared rows (NULL company) included.
--     Where an id is taken the sequence picks one, so look the grid up by name
--     there. Share grids/purchase_entry_v2_registration.py holds the same SQL.
--  7. Plain wording (notes 120), catalogue 2026-11-04.3: PUR_AMEND_OFF,
--     PUR_REVISION_STALE, PUR_HAS_RETURN, PUR_SHORTAGE_TOUCHED,
--     PUR_AMEND_STOCK_MOVED, PUR_AMEND_SUPPLIER, PUR_WASTAGE_INVALID,
--     PUR_QTY_DECIMALS, TRN_NAME_REQUIRED, TRN_GSTIN_INVALID, TRN_NAME_TAKEN (plan
--     §4.3 / §4.4), and the rights refusals the new routes raise through
--     assertMenuRight: PUR_RIGHT_AMEND and TRN_RIGHT_VIEW / _CREATE / _EDIT /
--     _DELETE (the approved SALES_RIGHT_* wording). prisma/seed/Error_Messages.json
--     carries the same rows.
--
--  Grid SQL holds no comments (the runner refuses "--" and "/*"). Inserted rows
--  start with *_sync_on / *_sync_date NULL (pending), like any new row; the
--  existing zz_sync_mark_dirty triggers mark the updated ones. Re-runnable:
--  every statement is guarded.
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
            (2318::bigint, 56::bigint, 54::bigint),
            (2319, 56, 55),
            (2320, 56, 56),
            (2321, 56, 57),
            (2322, 56, 58),
            (2323, 56, 59),
            (2324, 56, 60),
            (2325, 56, 61)
           ) v(id, tbl, no) ON v.id = c.ui_tbl_clm_id
     WHERE (c.ui_tbl_clm_table_id, c.ui_tbl_clm_no) IS DISTINCT FROM (v.tbl, v.no);
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Purchase entry v2 columns: ids already taken: %. Pick free ids here and in the seed file.', v_clash;
    END IF;
END $$;


-- ── 1 · pur_invoice_item: wastage + PO / GRN snapshot ─────────────────────
ALTER TABLE purchase.pur_invoice_item ADD COLUMN IF NOT EXISTS pii_wastage_per_qty numeric(18,6) NOT NULL DEFAULT 0;
ALTER TABLE purchase.pur_invoice_item ADD COLUMN IF NOT EXISTS pii_wastage_qty     numeric(18,6) NOT NULL DEFAULT 0;
ALTER TABLE purchase.pur_invoice_item ADD COLUMN IF NOT EXISTS pii_src_qty         numeric(18,6);
ALTER TABLE purchase.pur_invoice_item ADD COLUMN IF NOT EXISTS pii_src_rate        numeric(18,6);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'purchase.pur_invoice_item'::regclass AND conname = 'ck_pii_wastage') THEN
        ALTER TABLE purchase.pur_invoice_item
          ADD CONSTRAINT ck_pii_wastage
          CHECK (pii_wastage_per_qty >= 0 AND pii_wastage_per_qty < 1 AND pii_wastage_qty >= 0);
    END IF;
END $$;

COMMENT ON COLUMN purchase.pur_invoice_item.pii_wastage_per_qty IS
    'Wastage per 1 billed unit (0.100 = 100 g per kg): typed, else item_master.item_shortage_pct / 100. Own normal loss: no claim, not in stock, raises the cost, full ITC.';
COMMENT ON COLUMN purchase.pur_invoice_item.pii_wastage_qty IS
    'Billed x pii_wastage_per_qty, rounded to the unit''s decimals (server).';
COMMENT ON COLUMN purchase.pur_invoice_item.pii_src_qty IS
    'Snapshot at save of the source line qty: PO poi_qty, GRN gri_received_qty + gri_damaged_qty. NULL = direct line.';
COMMENT ON COLUMN purchase.pur_invoice_item.pii_src_rate IS
    'Snapshot at save of the source line rate: PO poi_rate, GRN its PO rate else gri_provisional_rate. NULL = direct line.';


-- ── 2 · transporter_master: the name index is no longer UNIQUE ────────────
DROP INDEX IF EXISTS public.ux_trn_name;

CREATE INDEX IF NOT EXISTS ix_trn_name
    ON public.transporter_master USING btree (trn_company_id, lower(trn_name))
    WHERE trn_is_deleted = false;


-- ── 3 · menus: Transport module off again, Transporters kept ──────────────
UPDATE fixed.menu_master m
   SET menu_is_active   = false,
       menu_visiblity   = false,
       menu_modified_on = now()
  FROM (VALUES
        (  8, NULL::integer, '8transport'),
        (126, 8, 'tripsheet'),
        (127, 8, 'headertypes'),
        (128, 8, 'vehiclerenewals'),
        (132, 8, 'fuellog'),
        (133, 8, 'servicelog'),
        (134, 8, 'tyremaintenance'),
        (135, 8, 'servicereminders'),
        (136, 8, 'reports')
       ) v(id, parent, name)
 WHERE m.menu_id = v.id
   AND m.menu_parent IS NOT DISTINCT FROM v.parent
   AND regexp_replace(lower(m.menu_name), '[&[:space:]]', '', 'g') = v.name
   AND (m.menu_is_active, m.menu_visiblity) IS DISTINCT FROM (false, false);

UPDATE fixed.menu_master m
   SET menu_is_active   = true,
       menu_visiblity   = true,
       menu_modified_on = now()
 WHERE m.menu_id = 149
   AND m.menu_parent = 26
   AND regexp_replace(lower(m.menu_name), '[&[:space:]]', '', 'g') = 'transporters'
   AND (m.menu_is_active, m.menu_visiblity) IS DISTINCT FROM (true, true);


-- ── 4 · setting: amend a posted purchase in place ─────────────────────────
INSERT INTO public.app_setting_def
    (asd_key, asd_module, asd_group, asd_data_type, asd_default_value, asd_allowed_values, asd_min_value, asd_max_value,
     asd_max_scope, asd_label, asd_description, asd_sort_order, asd_created_by)
SELECT 'purchase.allow_posted_amend', 'PURCHASE', 'Posting', 'BOOL', 'true', NULL, NULL, NULL,
       'COMPANY', 'Amend a posted purchase in place',
       'A posted bill nothing has paid, returned or moved out of stock can be changed and re-posted under its own number (revision + 1).',
       10, 'SYSTEM'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_setting_def d WHERE d.asd_key = 'purchase.allow_posted_amend');


-- ── 5a · ui_table 56: positions (all rows), visibility where stated ───────
UPDATE fixed.ui_table_columns c
   SET ui_tbl_clm_column_position   = v.pos,
       ui_tbl_clm_column_visibility = COALESCE(v.visible, c.ui_tbl_clm_column_visibility),
       ui_tbl_clm_modified_on       = now(),
       ui_tbl_clm_modified_by       = 'system'
  FROM (VALUES
        (56::bigint,  0::bigint,  0::integer, true::boolean),
        (56,  1,  1, true),
        (56, 47,  2, true),
        (56,  2,  3, true),
        (56, 32,  4, NULL),
        (56, 28,  5, NULL),
        (56, 30,  6, NULL),
        (56,  3,  7, true),
        (56,  4,  8, true),
        (56,  5, 11, true),
        (56,  6, 12, true),
        (56,  7, 13, true),
        (56,  8, 14, true),
        (56,  9, 17, true),
        (56, 10, 20, true),
        (56, 11, 21, true),
        (56, 45, 22, true),
        (56, 39, 23, true),
        (56, 46, 24, true),
        (56, 40, 25, true),
        (56, 52, 26, true),
        (56, 12, 27, true),
        (56, 13, 28, true),
        (56, 44, 29, true),
        (56, 14, 30, true),
        (56, 53, 31, true),
        (56, 15, 32, true),
        (56, 16, 33, true),
        (56, 41, 34, false),
        (56, 17, 35, NULL),
        (56, 48, 36, NULL),
        (56, 43, 37, NULL),
        (56, 33, 38, NULL),
        (56, 49, 39, NULL),
        (56, 34, 40, NULL),
        (56, 50, 41, NULL),
        (56, 35, 42, NULL),
        (56, 51, 43, NULL),
        (56, 36, 44, NULL),
        (56, 18, 45, true),
        (56, 24, 47, false),
        (56, 19, 48, false),
        (56, 20, 49, false),
        (56, 21, 50, false),
        (56, 22, 51, false),
        (56, 23, 52, false),
        (56, 25, 53, false),
        (56, 26, 54, false),
        (56, 27, 55, false),
        (56, 29, 56, false),
        (56, 31, 57, false),
        (56, 37, 58, false),
        (56, 38, 59, false),
        (56, 42, 60, false)
       ) v(tbl, no, pos, visible)
 WHERE c.ui_tbl_clm_table_id = v.tbl
   AND c.ui_tbl_clm_no       = v.no
   AND c.ui_tbl_clm_is_deleted = false
   AND EXISTS (SELECT 1 FROM fixed.ui_tables t WHERE t.ui_tbl_id = v.tbl AND t.ui_tbl_name = 'PURCHASE INVOICE - LINES')
   AND NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns n
                    WHERE n.ui_tbl_clm_table_id = v.tbl AND n.ui_tbl_clm_no = 54 AND n.ui_tbl_clm_is_deleted = false)
   AND (c.ui_tbl_clm_column_position, c.ui_tbl_clm_column_visibility)
       IS DISTINCT FROM (v.pos, COALESCE(v.visible, c.ui_tbl_clm_column_visibility));


-- ── 5b · ui_table 56: new columns, appended at their enum numbers ─────────
INSERT INTO fixed.ui_table_columns
       (ui_tbl_clm_id, ui_tbl_clm_table_id, ui_tbl_clm_no, ui_tbl_clm_name, ui_tbl_clm_column_width,
        ui_tbl_clm_column_visibility, ui_tbl_clm_column_focus, ui_tbl_clm_column_position,
        ui_tbl_clm_column_necessity, ui_tbl_clm_is_active, ui_tbl_clm_is_deleted, ui_tbl_clm_created_by)
SELECT v.id, v.tbl, v.no, v.name, v.width, v.visible, false, v.pos, false, true, false, 'system'
  FROM (VALUES
        (2318::bigint, 56::bigint, 54::bigint, 'Remarks'::text, 7.58::numeric, true::boolean, 46::integer),
        (2319, 56, 55, 'Weight',        3.79, false, 18),
        (2320, 56, 56, 'Stock',         3.79, true,   9),
        (2321, 56, 57, 'PO / GRN qty',  3.79, true,  10),
        (2322, 56, 58, 'PO / GRN rate', 4.55, true,  19),
        (2323, 56, 59, 'Decimals',      0,    false, 61),
        (2324, 56, 60, 'Wastage / qty', 4.55, true,  15),
        (2325, 56, 61, 'Wastage',       3.79, true,  16)
       ) v(id, tbl, no, name, width, visible, pos)
 WHERE EXISTS (SELECT 1 FROM fixed.ui_tables t WHERE t.ui_tbl_id = v.tbl AND t.ui_tbl_name = 'PURCHASE INVOICE - LINES')
   AND NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns e
                    WHERE e.ui_tbl_clm_table_id = v.tbl AND e.ui_tbl_clm_no = v.no AND e.ui_tbl_clm_is_deleted = false)
ON CONFLICT (ui_tbl_clm_id) DO NOTHING;

SELECT setval('fixed.ui_table_columns_ui_tbl_clm_id_seq',
              GREATEST((SELECT last_value FROM fixed.ui_table_columns_ui_tbl_clm_id_seq),
                       (SELECT COALESCE(MAX(ui_tbl_clm_id), 1) FROM fixed.ui_table_columns)), true);


-- ── 6a · grid POPUP - ITEM PURCHASE HISTORY (199) ─────────────────────────
INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_device_type,
        grid_sort_column, grid_sort_order, grid_sql, grid_status,
        grid_is_deleted, grid_created_by)
SELECT CASE WHEN EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_id = 199)
            THEN nextval(pg_get_serial_sequence('fixed.grid_details', 'grid_id'))
            ELSE 199 END,
       'POPUP - ITEM PURCHASE HISTORY',
       'Last purchases of one item (COM-04: Purchase Entry 24, PO 23, GRN): its last 50 POSTED bill lines, newest first, with unit, qty, free, rate, disc %, sch %, landed cost per unit, MRP and GST %. Tokens (send every one; '''' = all): icompany_id, iitem_id, isupplier_id, ibranch_id.',
       'Desktop',
       'pi_doc_date', 'Descending',
       $grid$SELECT pi.pi_id, pi.pi_company_id, pi.pi_branch_id, pi.pi_acc_year, pi.pi_doc_date, pi.pi_refno, s.sup_name, pi.pi_supplier_inv_no,
       um.unit_name, pii.pii_billed_qty, pii.pii_free_qty, pii.pii_rate, pii.pii_disc_pct, pii.pii_sch_pct,
       pii.pii_landed_cost_wot, pii.pii_mrp, pii.pii_gst_pct, pii.pii_uom_id, pi.pi_supplier_id
  FROM purchase.pur_invoice_item pii
  JOIN purchase.pur_invoice pi ON pi.pi_id = pii.pii_pi_id AND pi.pi_acc_year = pii.pii_acc_year
  JOIN purchase.suppliers s ON s.sup_id = pi.pi_supplier_id
  LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = pii.pii_uom_id
  LEFT JOIN inventory.item_unit_master um ON um.unit_id = iuc.iuc_unit_id
 WHERE pi.pi_company_id::text = 'icompany_id' AND pii.pii_item_id::text = 'iitem_id'
   AND (NULLIF('isupplier_id', '') IS NULL OR pi.pi_supplier_id::text = 'isupplier_id')
   AND (NULLIF('ibranch_id', '') IS NULL OR pi.pi_branch_id::text = 'ibranch_id')
   AND pi.pi_status = 'POSTED' AND NOT pi.pi_is_deleted AND NOT pii.pii_is_deleted
 ORDER BY pi.pi_doc_date DESC, pi.pi_created_on DESC
 LIMIT 50$grid$,
       true, false, 'system'
 WHERE NOT EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_name = 'POPUP - ITEM PURCHASE HISTORY');

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
        ( 2, 'Company',        0.00,          'left',  false, false, 'Text',     'pi_company_id'),
        ( 3, 'Branch',         0.00,          'left',  false, false, 'Text',     'pi_branch_id'),
        ( 4, 'Year',           0.00,          'left',  false, false, 'Text',     'pi_acc_year'),
        ( 5, 'Date',           8.00,          'left',  true,  false, 'Date',     'pi_doc_date'),
        ( 6, 'Bill',          16.00,          'left',  true,  true,  'Text',     'pi_refno'),
        ( 7, 'Supplier',      16.00,          'left',  true,  true,  'Text',     'sup_name'),
        ( 8, 'Supplier inv',   9.00,          'left',  true,  true,  'Text',     'pi_supplier_inv_no'),
        ( 9, 'Unit',           5.00,          'left',  true,  false, 'Text',     'unit_name'),
        (10, 'Qty',            6.00,          'right', true,  false, 'Number',   'pii_billed_qty'),
        (11, 'Free',           5.00,          'right', true,  false, 'Number',   'pii_free_qty'),
        (12, 'Rate',           7.00,          'right', true,  false, 'Currency', 'pii_rate'),
        (13, 'Disc %',         5.00,          'right', true,  false, 'Number',   'pii_disc_pct'),
        (14, 'Sch %',          5.00,          'right', true,  false, 'Number',   'pii_sch_pct'),
        (15, 'Landed / unit',  7.00,          'right', true,  false, 'Currency', 'pii_landed_cost_wot'),
        (16, 'MRP',            6.00,          'right', true,  false, 'Currency', 'pii_mrp'),
        (17, 'GST %',          5.00,          'right', true,  false, 'Number',   'pii_gst_pct'),
        (18, 'UomId',          0.00,          'left',  false, false, 'Text',     'pii_uom_id'),
        (19, 'SupplierId',     0.00,          'left',  false, false, 'Text',     'pi_supplier_id')
       ) AS v(col_no, col_name, width, align, visible, filterable, data_type, field)
 WHERE g.grid_name = 'POPUP - ITEM PURCHASE HISTORY'
   AND g.grid_is_deleted = false
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns c WHERE c.grid_id = g.grid_id);


-- ── 6b · grid MAIN LIST - TRANSPORTERS (200) ──────────────────────────────
INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_device_type,
        grid_sort_column, grid_sort_order, grid_sql, grid_status,
        grid_is_deleted, grid_created_by)
SELECT CASE WHEN EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_id = 200)
            THEN nextval(pg_get_serial_sequence('fixed.grid_details', 'grid_id'))
            ELSE 200 END,
       'MAIN LIST - TRANSPORTERS',
       'Transporters (public.transporter_master) for the Transporters master, menu 149: the company''s own rows and the shared ones (no company). Tokens (send every one): icompany_id, iinactive (''true'' shows switched-off ones).',
       'Desktop',
       'trn_name', 'Ascending',
       $grid$SELECT t.trn_id, t.trn_company_id, t.trn_code, t.trn_name, t.trn_gstin, t.trn_mode, t.trn_phone, t.trn_place,
       t.trn_state_code, t.trn_is_active
  FROM public.transporter_master t
 WHERE t.trn_is_deleted = false
   AND (t.trn_company_id IS NULL OR t.trn_company_id::text = 'icompany_id')
   AND ('iinactive' = 'true' OR t.trn_is_active)
 ORDER BY t.trn_name$grid$,
       true, false, 'system'
 WHERE NOT EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_name = 'MAIN LIST - TRANSPORTERS');

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
        ( 1, 'Id',       0.00::numeric, 'left', false, false, 'Text',    'trn_id'),
        ( 2, 'Company',  0.00,          'left', false, false, 'Text',    'trn_company_id'),
        ( 3, 'Code',    10.00,          'left', true,  true,  'Text',    'trn_code'),
        ( 4, 'Name',    30.00,          'left', true,  true,  'Text',    'trn_name'),
        ( 5, 'GSTIN',   16.00,          'left', true,  true,  'Text',    'trn_gstin'),
        ( 6, 'Mode',     8.00,          'left', true,  false, 'Text',    'trn_mode'),
        ( 7, 'Phone',   12.00,          'left', true,  true,  'Text',    'trn_phone'),
        ( 8, 'Place',   14.00,          'left', true,  true,  'Text',    'trn_place'),
        ( 9, 'State',    5.00,          'left', true,  false, 'Text',    'trn_state_code'),
        (10, 'Active',   5.00,          'left', true,  false, 'Boolean', 'trn_is_active')
       ) AS v(col_no, col_name, width, align, visible, filterable, data_type, field)
 WHERE g.grid_name = 'MAIN LIST - TRANSPORTERS'
   AND g.grid_is_deleted = false
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns c WHERE c.grid_id = g.grid_id);

SELECT setval(pg_get_serial_sequence('fixed.grid_details', 'grid_id'),
              GREATEST((SELECT max(grid_id) FROM fixed.grid_details),
                       (SELECT last_value FROM fixed.grid_details_grid_id_seq)))
 WHERE pg_get_serial_sequence('fixed.grid_details', 'grid_id') IS NOT NULL;


-- ── 7 · plain wording rows (notes 120), catalogue 2026-11-04.3 ─────────────
INSERT INTO fixed.error_message
    (erm_code, erm_variant, erm_lang, erm_title, erm_line, erm_todo)
VALUES
     ('PUR_AMEND_OFF', '', 'en', 'Amend is off', 'Changing a posted bill is switched off.', 'Ask your admin to turn on "Amend a posted purchase in place", or cancel the bill and enter it again.')
    ,('PUR_REVISION_STALE', '', 'en', 'Changed meanwhile', 'Someone changed this bill meanwhile.', 'Open it again and make your change.')
    ,('PUR_HAS_RETURN', '', 'en', 'Return entered', 'A return is entered against this bill.', 'Cancel that return first.')
    ,('PUR_SHORTAGE_TOUCHED', '', 'en', 'Shortage already used', 'A shortage of this bill is already received or closed.', 'Cancel that first.')
    ,('PUR_AMEND_STOCK_MOVED', '', 'en', 'Goods already gone out', 'Some of this bill''s goods have already been sold or moved.', 'Enter a Purchase Return for the difference instead.')
    ,('PUR_AMEND_SUPPLIER', '', 'en', 'Supplier cannot change', 'The supplier of a posted bill cannot change.', 'Cancel this bill and enter it again for the right supplier.')
    ,('PUR_WASTAGE_INVALID', '', 'en', 'Wastage too high', 'Wastage per qty is from 0 to less than 1 (0.100 = 100 g per kg), and received + damaged + wastage cannot be more than billed.', 'Correct the wastage or the qty on that line.')
    ,('PUR_QTY_DECIMALS', '', 'en', 'Too many decimals', 'This unit takes fewer decimals (a Box takes whole numbers only).', 'Type the qty as the unit allows, e.g. 2, not 1.250.')
    ,('TRN_NAME_REQUIRED', '', 'en', 'Name missing', 'The transporter name is empty.', 'Type the transporter''s name.')
    ,('TRN_GSTIN_INVALID', '', 'en', 'GSTIN not right', 'A GSTIN (or transporter enrolment id) is 15 characters, e.g. 33ABCDE1234F1Z5.', 'Correct it, or leave it blank.')
    ,('TRN_NAME_TAKEN', '', 'en', 'Name already used', 'A transporter with this name exists.', 'Pick it from the list instead.')
    ,('PUR_RIGHT_AMEND', '', 'en', 'Not allowed', 'You have no right to amend.', 'Call manager.')
    ,('TRN_RIGHT_VIEW', '', 'en', 'Not allowed', 'You have no right to open this.', 'Call manager.')
    ,('TRN_RIGHT_CREATE', '', 'en', 'Not allowed', 'You have no right to make new ones.', 'Call manager.')
    ,('TRN_RIGHT_EDIT', '', 'en', 'Not allowed', 'You have no right to change this.', 'Call manager.')
    ,('TRN_RIGHT_DELETE', '', 'en', 'Not allowed', 'You have no right to delete this.', 'Call manager.')
ON CONFLICT (erm_code, erm_variant, erm_lang) DO NOTHING;

UPDATE fixed.error_message_catalogue
   SET emc_version   = '2026-11-04.3',
       emc_row_count = (SELECT count(*) FROM fixed.error_message WHERE erm_is_active),
       emc_loaded_on = now()
 WHERE emc_id = 1
   AND emc_version < '2026-11-04.3';
