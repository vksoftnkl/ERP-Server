-- ═══════════════════════════════════════════════════════════════════════════
--  Repair the "CUSTOMERS BY AREA" dropdown (Receipt Entry's party picker)
--
--  20260915120000_receipt_voucher_prerequisites §8 created the row but
--
--    1. put the literal `true` into dropdown_completion (the column that names
--       the field the input echoes back), so the client looks for a column
--       called "true" and the chosen row's text comes back empty; and
--    2. never inserted its fixed.dropdown_columns rows at all.
--
--  The client builds the popup from those column rows: with none, every
--  customer draws as a blank line and a pick is refused because the id column
--  is unknown. The dev database was repaired by hand in Dropdown Master on
--  2026-09-16; this makes that repair part of the schema so every deployment
--  gets it.
--
--  Keyed by dropdown_name, not dropdown_id: the id is a per-deployment serial
--  (49 on the VPS, 54 on dev). Idempotent — the UPDATE is a fixed point and the
--  INSERT is guarded by "this dropdown already has columns".
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE fixed.dropdown_details
   SET dropdown_completion  = 'cus_name',
       dropdown_show_header = false,
       dropdown_width       = 0
 WHERE dropdown_name = 'CUSTOMERS BY AREA'
   AND (dropdown_completion IS DISTINCT FROM 'cus_name'
        OR dropdown_show_header IS DISTINCT FROM false
        OR dropdown_width IS DISTINCT FROM 0);

INSERT INTO fixed.dropdown_columns
       (dropdown_columns_dropdown_id, dropdown_columns_no, dropdown_columns_name,
        dropdown_columns_sql_name, dropdown_columns_data_type, dropdown_columns_width,
        dropdown_columns_allignment, dropdown_columns_visiblity, dropdown_columns_filter,
        dropdown_columns_created_by)
SELECT d.dropdown_id, c.col_no, c.col_name, c.sql_name, 'Text', c.width,
       'Left', c.visible, c.filter, 'system'
  FROM fixed.dropdown_details d
 CROSS JOIN (VALUES (0, '#',        'cus_id',   10.00::numeric(12,2), false, false),
                    (1, 'Customer', 'cus_name', 100.00::numeric(12,2), true,  true))
       AS c(col_no, col_name, sql_name, width, visible, filter)
 WHERE d.dropdown_name = 'CUSTOMERS BY AREA'
   AND NOT EXISTS (SELECT 1
                     FROM fixed.dropdown_columns x
                    WHERE x.dropdown_columns_dropdown_id = d.dropdown_id);

-- Read-back:
--   SELECT d.dropdown_id, d.dropdown_completion, count(c.dropdown_columns_id)
--     FROM fixed.dropdown_details d
--     LEFT JOIN fixed.dropdown_columns c ON c.dropdown_columns_dropdown_id = d.dropdown_id
--    WHERE d.dropdown_name = 'CUSTOMERS BY AREA' GROUP BY 1, 2;
