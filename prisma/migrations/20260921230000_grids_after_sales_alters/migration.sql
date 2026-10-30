-- ═══════════════════════════════════════════════════════════════════════════
--  Grid configuration, after the sales alters
--
--  20260921220000 dropped sales.sale_quotation.sq_cancelled_on (the cancel
--  TIME now lives on public.txn_status_log, one appended row per step). Two
--  CONFIGURED GRIDS still select it:
--
--      grid 83  TXN MAIN LIST - QUOTATION
--      grid 84  Quotation
--
--  A configured grid's SQL is stored in fixed.grid_details and executed as
--  written, so this is not a compile error anybody would catch — it is a 42703
--  the first time somebody opens the quotation list. The application code was
--  fixed in the same breath as the column; this is the half of the change that
--  lives in DATA.
--
--  Done as text surgery on the stored SQL rather than a rewrite: the grids
--  carry hand-tuned column lists, and replacing them wholesale would discard
--  edits made since the seed was last run.
-- ═══════════════════════════════════════════════════════════════════════════

-- The select-list entry, in both the forms the two grids store it in: as the
-- LAST column before FROM (grid 84, no trailing comma) and with whitespace
-- and a blank line around it (grid 83).
UPDATE fixed.grid_details
   SET grid_sql = regexp_replace(grid_sql, ',\s*q\.sq_cancelled_on', '', 'gi'),
       grid_modified_on = now(),
       grid_modified_by = 'MIGRATION'
 WHERE grid_sql ~* 'q\.sq_cancelled_on';

-- The column definitions that named it: one visible ("Cancelled On") and three
-- hidden spares on grid 83. A grid column whose field is not in the SELECT
-- renders empty at best.
DELETE FROM fixed.grid_columns
 WHERE grid_column_sql_field_name = 'sq_cancelled_on';

DO $check$
DECLARE n_sql int; n_col int;
BEGIN
    SELECT count(*) INTO n_sql FROM fixed.grid_details WHERE grid_sql ~* 'sq_cancelled_on';
    SELECT count(*) INTO n_col FROM fixed.grid_columns WHERE grid_column_sql_field_name = 'sq_cancelled_on';
    IF n_sql > 0 OR n_col > 0 THEN
        RAISE EXCEPTION 'sq_cancelled_on still referenced: % grid SQL, % grid columns', n_sql, n_col;
    END IF;
    RAISE NOTICE 'Grid config clean: no reference to sq_cancelled_on remains.';
END
$check$;
