-- ═══════════════════════════════════════════════════════════════════════════
--  Retire grid 5 "item tax master". 2026-09-30.
--
--  inventory.item_tax_master is retired: every item / group / tax-history tax id
--  is a tax_rate_master id (20260912110000), the readers were repointed and the
--  items-tax-master module with its /item-taxes routes was removed today. Grid 5
--  was that module's list, SELECTing from the old table; the Tax Master screen
--  lists rates through GET /tax-rates/list. Removed the way 20260922080000
--  removed grid 64 — its columns first (grid_columns cascades anyway) — and
--  dropped from prisma/seed/Grid_Details.sql and Grid_Columns.sql in the same
--  change, so a fresh database does not seed it back.
--
--  Guarded on the name: only the grid that IS the old tax list goes.
--  The table itself stays (no reader, no FK into it) until it is dropped on
--  purpose.
-- ═══════════════════════════════════════════════════════════════════════════

DELETE FROM fixed.grid_columns c
 USING fixed.grid_details g
 WHERE c.grid_id = g.grid_id
   AND g.grid_id = 5
   AND g.grid_name = 'item tax master';

DELETE FROM fixed.grid_details
 WHERE grid_id = 5
   AND grid_name = 'item tax master';
