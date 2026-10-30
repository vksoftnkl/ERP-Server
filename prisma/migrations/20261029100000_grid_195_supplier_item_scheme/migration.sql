-- ═══════════════════════════════════════════════════════════════════════════
--  Grid 195 MAIN LIST - SUPPLIER ITEMS returns and shows the supplier scheme.
--
--  Migration 20261028150000_supplier_item_scheme added
--  purchase.pur_supplier_item.psi_scheme_buy_qty / psi_scheme_free_qty, but the
--  grid never selected them, so the Supplier-Item Map list (menu 295) shows no
--  scheme and SupplierItemEntry::fromRow opens the edit form with blank scheme
--  fields.
--
--  A. grid_sql: the two columns after p.psi_lead_days. Nothing else changes.
--  B. grid_columns: "Scheme Buy" (14) and "Scheme Free" (15) after Lead days
--     (13), shaped like MOQ (Number, right, visible, no filter, width 4).
--     Last rate .. Source move from 14..19 to 16..21 (number and position,
--     which the rows keep equal).
--  C. Widths are percent: Supplier and Item (the widest text columns, 14 each)
--     give 4 each, so the visible total stays 97.
--
--  Grid 195 is registered through the API (share grids/
--  purchase_masters_registration.py, kept in step with this file), not
--  prisma/seed/Grid_Details.sql, so there is no seed row to edit; on a fresh
--  database every statement matches no row. A is guarded on the old text and
--  B / C on the scheme column rows being absent, so a second run does nothing.
--  *_sync_on is set by the zz_sync_mark_dirty triggers on UPDATE; inserted
--  rows start with grid_column_sync_on NULL (pending), like any new row.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE fixed.grid_details
   SET grid_sql = replace(grid_sql,
$mig$p.psi_pack_qty, p.psi_moq, p.psi_lead_days, st.last_rate,$mig$,
$mig$p.psi_pack_qty, p.psi_moq, p.psi_lead_days, p.psi_scheme_buy_qty, p.psi_scheme_free_qty, st.last_rate,$mig$),
       grid_modified_by = 'system',
       grid_modified_on = now()
 WHERE grid_id = 195
   AND grid_name = 'MAIN LIST - SUPPLIER ITEMS'
   AND position('p.psi_pack_qty, p.psi_moq, p.psi_lead_days, st.last_rate,' IN grid_sql) > 0
   AND position('psi_scheme_buy_qty' IN grid_sql) = 0;

UPDATE fixed.grid_columns c
   SET grid_column_number   = c.grid_column_number + 2,
       grid_column_position = c.grid_column_position + 2,
       grid_column_modified_by = 'system',
       grid_column_modified_on = now()
 WHERE c.grid_id = 195
   AND c.grid_column_is_deleted = false
   AND c.grid_column_number > 13
   AND EXISTS (SELECT 1 FROM fixed.grid_columns l
                WHERE l.grid_id = 195 AND l.grid_column_is_deleted = false
                  AND l.grid_column_sql_field_name = 'psi_lead_days' AND l.grid_column_number = 13)
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns x
                    WHERE x.grid_id = 195 AND x.grid_column_is_deleted = false
                      AND x.grid_column_sql_field_name IN ('psi_scheme_buy_qty', 'psi_scheme_free_qty'));

UPDATE fixed.grid_columns c
   SET grid_column_width = c.grid_column_width - 4,
       grid_column_modified_by = 'system',
       grid_column_modified_on = now()
 WHERE c.grid_id = 195
   AND c.grid_column_is_deleted = false
   AND c.grid_column_sql_field_name IN ('sup_name', 'item_name')
   AND c.grid_column_width = 14
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns x
                    WHERE x.grid_id = 195 AND x.grid_column_is_deleted = false
                      AND x.grid_column_sql_field_name IN ('psi_scheme_buy_qty', 'psi_scheme_free_qty'));

INSERT INTO fixed.grid_columns
       (grid_id, grid_column_number, grid_column_name, grid_column_width, grid_column_alignment,
        grid_column_visibility, grid_column_filter, grid_column_group, grid_column_total,
        grid_column_data_type, grid_column_is_deleted, grid_column_position, grid_column_sql_field_name,
        grid_column_created_by, grid_column_modified_by, grid_column_modified_on)
SELECT m.grid_id, n.num, n.caption, m.grid_column_width, m.grid_column_alignment,
       m.grid_column_visibility, m.grid_column_filter, m.grid_column_group, m.grid_column_total,
       m.grid_column_data_type, false, n.num, n.field,
       'system', 'system', now()
  FROM fixed.grid_columns m
 CROSS JOIN (VALUES (14, 'Scheme Buy',  'psi_scheme_buy_qty'),
                    (15, 'Scheme Free', 'psi_scheme_free_qty')) AS n(num, caption, field)
 WHERE m.grid_id = 195
   AND m.grid_column_is_deleted = false
   AND m.grid_column_sql_field_name = 'psi_moq'
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns x
                    WHERE x.grid_id = 195 AND x.grid_column_is_deleted = false
                      AND x.grid_column_sql_field_name IN ('psi_scheme_buy_qty', 'psi_scheme_free_qty'));
