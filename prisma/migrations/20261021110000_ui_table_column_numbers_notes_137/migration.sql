-- ═══════════════════════════════════════════════════════════════════════════
--  ui_table_columns: one live column per number on a table (notes 137 E).
--
--  On 2026-10-12 ui_table 17 (ITEM MASTER - PRICE) gained 22 extra column rows
--  (ids 1918-1939) that reused numbers 4-33: /ui-table-masters/create without
--  replaceColumns APPENDS. The Qt grid then hid Unit, Godown, Cost, Price A
--  margin, MRP and Disc %, so no new price row could be entered. Those rows
--  were removed on the box by hand; the Qt grid now keeps the FIRST row of a
--  column number (lowest id — the API lists by number, then id) and ignores
--  the rest; UiTableMasterService refuses a save that would leave two.
--
--  1. Live rows that share a (table, number) are reduced to that first row,
--     the one every screen shows today, so nothing visible changes. On the dev
--     box that is Grid Master (ui_table 7) number 15: FontRole (143) stays and
--     Notes (144) goes. Soft deleted, so a row can be brought back under a
--     free number. prisma/seed/Ui_Table_Columns.sql seeds 144 deleted to match.
--
--  2. ex_ui_tbl_clm_no holds the rule. An EXCLUSION constraint rather than the
--     partial unique index the notes asked for, because only a constraint can
--     be DEFERRABLE: a save that swaps two columns' numbers passes through a
--     clash between its two UPDATEs, and a plain unique index would refuse it.
--     Checked at commit; NULL table ids or numbers never clash.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE fixed.ui_table_columns c
   SET ui_tbl_clm_is_deleted  = true,
       ui_tbl_clm_is_active   = false,
       ui_tbl_clm_modified_on = now(),
       ui_tbl_clm_modified_by = 'MIGRATION'
 WHERE c.ui_tbl_clm_is_deleted = false
   AND c.ui_tbl_clm_table_id IS NOT NULL
   AND c.ui_tbl_clm_no IS NOT NULL
   AND EXISTS (
         SELECT 1
           FROM fixed.ui_table_columns k
          WHERE k.ui_tbl_clm_is_deleted = false
            AND k.ui_tbl_clm_table_id = c.ui_tbl_clm_table_id
            AND k.ui_tbl_clm_no = c.ui_tbl_clm_no
            AND k.ui_tbl_clm_id < c.ui_tbl_clm_id);

ALTER TABLE fixed.ui_table_columns
  ADD CONSTRAINT ex_ui_tbl_clm_no
  EXCLUDE USING btree (ui_tbl_clm_table_id WITH =, ui_tbl_clm_no WITH =)
  WHERE (ui_tbl_clm_is_deleted = false)
  DEFERRABLE INITIALLY DEFERRED;
