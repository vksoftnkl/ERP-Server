-- ═══════════════════════════════════════════════════════════════════════════
--  26 · POINT DROPDOWN 36 (TAXES) AT tax_rate_master
--
--  This is §7 of 20260912110000_repoint_items_to_tax_rate_master, which said
--  to run it LAST and only after that migration — so it is the very next one.
--
--  ── WHY IT CANNOT LAG BEHIND 20260912110000 ─────────────────────────────
--  That migration moved item_master.item_default_tax_id onto
--  inventory.tax_rate_master and swapped the foreign key to match. Dropdown
--  36 is what fills the Default Tax field on item entry, and it still reads
--  the OLD inventory.item_tax_master — whose ids are not in the new master at
--  all (the two tables were seeded clean-sheet and share none). So between
--  the two migrations, the item screen offers the operator a list of ids that
--  the new FK then refuses, and every item save that touches the tax field
--  fails. Observed on the VPS the moment 20260912110000 went in (2026-09-12).
--
--  Before 20260912110000 the exposure was the mirror image and just as bad,
--  which is why the original note insisted on this order: flip the dropdown
--  first and the ids it offers are refused by the FK that still named the old
--  table. There is no ordering that avoids a window — only one that keeps the
--  window inside a single deploy, which is this one.
--
--  ── WHY THE SELECT KEEPS EXACTLY TWO COLUMNS ────────────────────────────
--  fixed.dropdown_columns has two rows for dropdown 36 — tax_id (hidden, the
--  value) and tax_name (shown, filterable) — and they are what the client
--  renders by. §6a of the previous migration sketched a SELECT that also
--  returns tax_rate_perc and tax_taxability, which would be genuinely more
--  useful to look at, but those columns have no dropdown_columns rows and
--  adding them is a display change, not this fix. Left for its own migration.
--
--  The ORDER BY does change: tax_sort_order first, which is the column the
--  new master carries for exactly this purpose and which puts the slabs in
--  rate order (0, 0.25, 3, 5, 12, 18, 28) ahead of the non-taxable kinds,
--  instead of the alphabetical 'GST 0%, GST 0.25%, GST 12%, GST 18%'.
--
--  ── THE SEED WAS FIXED TOO ───────────────────────────────────────────────
--  prisma/seed/Dropdown_Details.sql carries the same SQL for a fresh
--  database. It inserts ON CONFLICT (dropdown_id) DO NOTHING, so re-seeding
--  an existing server cannot undo this UPDATE, but a NEW one would otherwise
--  be created broken in the same way.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE fixed.dropdown_details
   SET dropdown_sql = $q$SELECT
	tax_id,
	tax_name
FROM inventory.tax_rate_master
WHERE tax_is_active = true AND tax_is_deleted = false
ORDER BY tax_sort_order, tax_name;$q$,
       dropdown_modified_by = 'migration 20260912120000',
       dropdown_modified_on = now()
 WHERE dropdown_sql ILIKE '%inventory.item_tax_master%';

-- The regional variant is a separate payload and is NULL on both databases
-- today; rewrite it in place rather than leave a second copy pointing at the
-- old table on any server that has filled it in.
UPDATE fixed.dropdown_details
   SET dropdown_sql_regional = replace(dropdown_sql_regional,
                                       'inventory.item_tax_master',
                                       'inventory.tax_rate_master'),
       dropdown_modified_by = 'migration 20260912120000',
       dropdown_modified_on = now()
 WHERE dropdown_sql_regional ILIKE '%inventory.item_tax_master%';

-- ── Prove it ──────────────────────────────────────────────────────────────
--  No dropdown may still hand out ids from the old master now that the item
--  FK refuses them. fixed.grid_details is deliberately NOT swept: grid 5 is
--  the maintenance screen FOR item_tax_master, which still exists and is
--  still editable until the table is dropped (§6b of the previous migration).
DO $$
DECLARE
    bad text;
BEGIN
    SELECT string_agg(format('%s (%s)', dropdown_id, dropdown_name), ', '
                      ORDER BY dropdown_id)
      INTO bad
      FROM fixed.dropdown_details
     WHERE dropdown_sql          ILIKE '%inventory.item_tax_master%'
        OR dropdown_sql_regional ILIKE '%inventory.item_tax_master%';

    IF bad IS NOT NULL THEN
        RAISE EXCEPTION
          'these dropdowns still read inventory.item_tax_master, whose ids the item FK now refuses: %',
          bad;
    END IF;
END $$;
