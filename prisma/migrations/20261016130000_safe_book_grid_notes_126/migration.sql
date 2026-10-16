-- ═══════════════════════════════════════════════════════════════════════════
--  Notes 126 §3 — grid 158 TILL SAFE BOOK: the till's own transfers (TFlt /
--  TDrp / TRcv / CRem) now carry tender rows too (td_src_doc_type 'VOUCHER',
--  the server's label on a cash line). The grid's "back-office cash on the safe
--  ledger" branch must skip them, as TillSafeService does: the grid's movement
--  branches already count that cash. Grid 158 was made on the grid designer
--  and is in no seed file, so the UPDATE is guarded on its name and old text
--  and does nothing where the row is not there.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE fixed.grid_details
   SET grid_sql = replace(
         grid_sql,
         'WHERE t.td_tender_ledger_id = sf.tsf_ledger_id AND t.td_tender_type_id = 1',
         'WHERE t.td_tender_ledger_id = sf.tsf_ledger_id AND t.td_tender_type_id = 1 AND t.td_src_doc_type <> ''VOUCHER'''),
       grid_modified_by = 'system',
       grid_modified_on = now()
 WHERE grid_id = 158
   AND grid_name = 'TILL SAFE BOOK'
   AND position('WHERE t.td_tender_ledger_id = sf.tsf_ledger_id AND t.td_tender_type_id = 1' IN grid_sql) > 0
   AND position('td_src_doc_type <> ''VOUCHER''' IN grid_sql) = 0;
