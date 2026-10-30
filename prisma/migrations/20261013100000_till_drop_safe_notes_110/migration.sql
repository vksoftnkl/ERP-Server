-- ═══════════════════════════════════════════════════════════════════════════
--  Till: a DROP goes into a drop safe — notes 110 §3 (2026-10-13)
--
--  A drop is a sealed bag pushed into a drop box at the counter, with nobody
--  receiving it. /till/movements/create now posts a DROP only to the counter's
--  OWN safe (tcn_safe_id, no fallback to the branch default), and only when
--  that safe is flagged as a drop safe; otherwise 422 TILL_NO_DROP_SAFE: the
--  bag goes into a supervisor's hand as a PICKUP instead.
--
--  CHECK-free, per the house rule. Every existing safe starts as NOT a drop
--  safe, so a counter takes no drop until its safe is ticked (Till Safes,
--  menu 280).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE accounts.till_safe
    ADD COLUMN IF NOT EXISTS tsf_is_drop_safe boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN accounts.till_safe.tsf_is_drop_safe IS
    'A drop box at the counter: a counter whose own safe has it takes DROPs (notes 110); false = a DROP is refused, hand the bag over as a PICKUP.';

-- The safe list grid (made in the grid designer, not seeded) carries the flag
-- for the Till Safes screen's "Drop safe" tick. Matched by name, since its id
-- differs per box; a database without it, or already carrying it, is left alone.
UPDATE fixed.grid_details
   SET grid_sql = replace(grid_sql, 's.tsf_is_default,', 's.tsf_is_default, s.tsf_is_drop_safe,'),
       grid_modified_on = now()
 WHERE grid_name = 'MAIN LIST - TILL SAFES'
   AND grid_is_deleted = false
   AND grid_sql LIKE '%s.tsf_is_default,%'
   AND grid_sql NOT LIKE '%tsf_is_drop_safe%';
