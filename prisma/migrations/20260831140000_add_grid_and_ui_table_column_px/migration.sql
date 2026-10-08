-- fixed.grid_columns / fixed.ui_table_columns: add the *_px presentation column.
--
-- Both tables already carry a numeric width (grid_column_width,
-- ui_tbl_clm_column_width). The new column stores the client-side pixel sizing
-- as free text so a column can be pinned with a CSS-style value ("120px",
-- "12rem", "minmax(80px, 1fr)") that a Decimal width cannot express. It stays
-- nullable with no default: an unset column keeps deriving its size from the
-- existing width, so every existing row and every client that does not send
-- the field behaves exactly as before.
ALTER TABLE fixed.grid_columns
    ADD COLUMN grid_column_px TEXT;

ALTER TABLE fixed.ui_table_columns
    ADD COLUMN ui_tbl_clm_px TEXT;
