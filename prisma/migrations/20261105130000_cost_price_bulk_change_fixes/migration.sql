-- ═══════════════════════════════════════════════════════════════════════════
--  Cost Price – Bulk Change (menu 298): review fixes               2026-11-05
--  Follows 20261105120000_cost_price_bulk_change. Data only.
--
--  1 · fixed.error_message COST_BULK_COST_TOO_LOW: a New Cost so low that the
--      profit % of the prices overflows the markup column (a mistyped cost).
--      Catalogue 2026-11-05.3.
--
--  2 · ui_table 67 widths: the four "New" level columns (slots 10 / 13 / 16 /
--      19) were too narrow at 1680 px ("TYPED 1,000.00" was cut). They go from
--      5.11 to 6.00 % each; Item (slot 1) gives the difference, 14.20 to 10.68,
--      so the visible columns add up to 100.00. Nothing else changes.
--
--  prisma/seed/Error_Messages.json and Ui_Table_Columns.sql carry the same
--  values. Re-runnable: every statement is guarded.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · plain wording row (notes 120), catalogue 2026-11-05.3 ──────────────
INSERT INTO fixed.error_message
    (erm_code, erm_variant, erm_lang, erm_title, erm_line, erm_todo)
VALUES
     ('COST_BULK_COST_TOO_LOW', '', 'en', 'Cost too low for these prices', 'The new cost is so low that the profit on these prices cannot be stored — the figure is probably mistyped.', 'Check the New Cost.')
ON CONFLICT (erm_code, erm_variant, erm_lang) DO NOTHING;

UPDATE fixed.error_message_catalogue
   SET emc_version   = '2026-11-05.3',
       emc_row_count = (SELECT count(*) FROM fixed.error_message WHERE erm_is_active),
       emc_loaded_on = now()
 WHERE emc_id = 1
   AND emc_version < '2026-11-05.3';


-- ── 2 · ui_table 67: wider New prices, narrower Item ───────────────────────
UPDATE fixed.ui_table_columns c
   SET ui_tbl_clm_column_width = v.width,
       ui_tbl_clm_modified_on  = now()
  FROM (VALUES
        (1::bigint, 'Item'::text, 10.68::numeric),
        (10, 'New', 6.00),
        (13, 'New', 6.00),
        (16, 'New', 6.00),
        (19, 'New', 6.00)
       ) v(no, name, width)
 WHERE c.ui_tbl_clm_table_id = 67
   AND c.ui_tbl_clm_no = v.no
   AND c.ui_tbl_clm_name = v.name
   AND c.ui_tbl_clm_is_deleted = false
   AND EXISTS (SELECT 1 FROM fixed.ui_tables t WHERE t.ui_tbl_id = 67 AND t.ui_tbl_name = 'COST PRICE BULK CHANGE - ROWS')
   AND c.ui_tbl_clm_column_width IS DISTINCT FROM v.width;
