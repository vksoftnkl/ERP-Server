-- ═══════════════════════════════════════════════════════════════════════════
--  Notes 132 — grid 119 POPUP - VOUCHER LEDGERS lost its four comment lines.
--
--  Migration 20261016160000 (notes 130) wrote "--" comment lines into the
--  grid's SQL. The grid runner refuses any configured SQL holding "--" or "/*"
--  (GRID_RUN_SQL_INVALID "Comments are not allowed in configured query"), so
--  the Voucher Register ledger cell listed nothing on every type. This removes
--  those four lines and nothing else. Guarded on the comment text, so it does
--  nothing where they are already gone.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE fixed.grid_details
   SET grid_sql = replace(replace(grid_sql,
$mig$   -- notes 130: the money side is a tender (the instrument / a Contra line's
   -- tender list), never a typed cash / bank ledger -- the server refuses one
   -- (VCH_MONEY_LEDGER_NOT_ALLOWED / VCH_MONEY_LINE_NO_TENDER), on every type
$mig$, ''),
$mig$   -- ...and the money side of a Receipt (Dr) / Payment (Cr) lists nothing at all
$mig$, ''),
       grid_modified_by = 'system',
       grid_modified_on = now()
 WHERE grid_id = 119
   AND grid_name = 'POPUP - VOUCHER LEDGERS'
   AND (position('   -- notes 130: the money side is a tender' IN grid_sql) > 0
     OR position('   -- ...and the money side of a Receipt' IN grid_sql) > 0);
