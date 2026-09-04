-- Quotation item grid (ui table 23, "Quotation-item") — the ItemSize column.
--
-- Backs sale_quotation_item.sqi_item_size, added in migration
-- 20260808055111_added_column_in_sale_quot_item_table. The client resolves grid
-- columns by matching each fixed.ui_table_columns row against its local
-- ITEM_COLUMN_MEANINGS list (quotation.constants.ts) on a normalized token —
-- lowercased, non-alphanumerics stripped — and SKIPS any meaning with no row
-- here. So without this insert the field round-trips through save/load but has
-- no cell to type it into, and every line saves sqi_item_size = NULL.
--
-- The meaning is declared last in ITEM_COLUMN_MEANINGS and the client sorts the
-- resolved columns by ui_tbl_clm_no, so this row must take the highest number on
-- the table — hence max(no) + 1 rather than a hardcoded 90.
--
-- NOT applied to ui table 18 ("Quotation Item Table"): that is the legacy Qt
-- screen's own layout, this client never loads it (see ITEM_GRID_UI_TABLE_ID),
-- and its widths are fractional percents rather than the pixels used below.
--
-- Idempotent: re-running inserts nothing once the column exists, under any
-- punctuation of the name ("ItemSize", "Item Size", "Item-Size" all normalize to
-- the same token the client matches on). Safe to re-run.
BEGIN;

INSERT INTO fixed.ui_table_columns (
  ui_tbl_clm_no,
  ui_tbl_clm_table_id,
  ui_tbl_clm_name,
  ui_tbl_clm_column_width,
  ui_tbl_clm_column_visibility,
  ui_tbl_clm_column_focus,
  ui_tbl_clm_column_position,
  ui_tbl_clm_column_necessity,
  ui_tbl_clm_is_active,
  ui_tbl_clm_is_deleted,
  ui_tbl_clm_created_by,
  ui_tbl_clm_modified_by
)
SELECT
  next_no.value,
  23,
  'ItemSize',
  100,
  true,
  false,
  next_no.value,
  false,
  true,
  false,
  -- Same actor the rest of the table-23 rows carry, rather than a uuid
  -- hardcoded here: this file has to run against every environment.
  owner.created_by,
  owner.created_by
FROM
  (SELECT COALESCE(MAX(ui_tbl_clm_no), 0) + 1 AS value
     FROM fixed.ui_table_columns
    WHERE ui_tbl_clm_table_id = 23) AS next_no,
  (SELECT ui_tbl_clm_created_by AS created_by
     FROM fixed.ui_table_columns
    WHERE ui_tbl_clm_table_id = 23
    ORDER BY ui_tbl_clm_no
    LIMIT 1) AS owner
WHERE NOT EXISTS (
  SELECT 1
    FROM fixed.ui_table_columns
   WHERE ui_tbl_clm_table_id = 23
     AND lower(regexp_replace(COALESCE(ui_tbl_clm_name, ''), '[^a-zA-Z0-9]+', '', 'g')) = 'itemsize'
);

COMMIT;
