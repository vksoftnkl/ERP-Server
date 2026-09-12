-- ═══════════════════════════════════════════════════════════════════════════
--  25 · MOVE THE ITEMS OFF item_tax_master AND ONTO tax_rate_master
--
--  Written 2026-09-12 against the live 192.168.0.106/ERP. This is §4c of
--  20_tax_rate_master.sql, with the data step it was waiting for filled in.
--
--  ── WHY IT CANNOT BE SKIPPED ────────────────────────────────────────────
--  inventory.tax_rate_master is the master the GST Rate screen (menu 40)
--  maintains, and the one every posting decision resolves through. The item
--  master still points at the OLD inventory.item_tax_master:
--
--      item_master.item_default_tax_id      -> item_tax_master(tax_id)
--      item_tax_history.ith_tax_id          -> item_tax_master(tax_id)
--
--  The two tables share NO ids — tax_rate_master was seeded clean-sheet, not
--  migrated (verified: 0 ids in common). So until this runs, the item entry
--  screen cannot be pointed at the new master at all:
--    · its Default Tax dropdown would offer ids the FK then refuses on save;
--    · /tax-rates/get answers 404 for every id the 10,034 existing items
--      carry, so merely OPENING an item would raise an error.
--
--  ── WHAT THE DATA LOOKS LIKE (live, 2026-09-12) ─────────────────────────
--  10,034 items carry a tax id; 55 carry none; 0 are orphaned.
--  item_tax_history is EMPTY (0 rows), so only item_master holds real data.
--
--      old row                    items   ->  new row
--      ─────────────────────────────────────────────────────────────
--      GST 18%        18/0/0       4335   ->  GST 18%
--      GST 5%          5/0/0       3004   ->  GST 5%
--      GST 12%        12/0/0       2001   ->  GST 12%
--      GST 0%          0/0/0        666   ->  GST 0%
--      GST @ 18%      18 + 5/unit    16   ->  GST 18%   (cess dropped — see below)
--      Excempted (GST @ 0%)           5   ->  Exempt    (taxability EXEMPT)
--      GST @ 5% + Cess @ 3%           3   ->  GST 5%    (cess dropped — see below)
--      test2 / test / tax 10%         0   ->  nothing to move
--
--  ── NINETEEN ITEMS CARRY CESS; THE CESS IS DROPPED ──────────────────────
--  tax_rate_master has no cess-bearing row — the seeded slabs are the seven
--  statutory rates plus the four non-taxable kinds. Nineteen items sit on two
--  old rows that do carry cess ('GST @ 18%' with 5 per unit, 'GST @ 5% + Cess
--  @ 3%'), and this maps them to the plain rate and drops the cess.
--
--  Confirmed with the user 2026-09-12: the existing figures are test data, not
--  a tax position, so there is nothing to preserve. It shows in the rows —
--  chilli powder, turmeric, biscuits, a matchbox, aspirin, and eight plainly
--  typed to exercise the screen ('fdfdff', 'undskndk', 'thursday'). None of
--  them attracts compensation cess in law, which is for tobacco, aerated
--  drinks, coal and motor vehicles.
--
--  If a real cess-bearing item ever needs one: create the rate on the GST Rate
--  screen first, then add its name to the mapping in section 2. Section 4 will
--  not let a wrong answer through quietly — the FK refuses to be added while
--  any item still points at the old table.
--
--  ── THREE CHANGES MADE WHEN THIS BECAME A PRISMA MIGRATION (2026-09-12) ──
--  a) Sections 1 and 5 were bare SELECTs, written to be eyeballed in psql. A
--     migration has nobody reading its output, so they are DO blocks that
--     RAISE EXCEPTION instead: an unmapped old row, or a mapping name that
--     does not resolve to exactly one live rate, now aborts the migration
--     rather than scrolling past. Section 5 reports its tallies as NOTICEs.
--  b) Section 2b was added. inventory.item_group_master.itg_default_tax_id
--     holds the same old ids on 30 groups and has NO foreign key, so section 4
--     cannot catch it — the group default would keep handing the item screen
--     ids the FK refuses. All 30 sit on GST 18/5/12/0%, already in the
--     mapping, and no cess is involved.
--  c) The constraint swap was split in two. Section 4a drops the old pair
--     BEFORE the updates — as written, the FK to item_tax_master was still in
--     force while section 2 wrote tax_rate_master ids, so the first row was
--     rejected and the script could never have run to the end. Section 4b adds
--     the new pair after, in the same transaction, and is still what proves
--     the data. DROP also gained IF EXISTS so a database already repointed by
--     hand does not halt here.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1 · Prove the mapping covers everything, BEFORE touching a row ────────
--  Anything caught here is an old tax row with items on it and no answer in
--  the mapping below, or a mapping target that does not resolve to exactly
--  one live rate. Either way: stop, do not update anything.
DO $$
DECLARE
    bad text;
BEGIN
    WITH mapping(old_name, new_name) AS (VALUES
            ('GST 18%',              'GST 18%'),
            ('GST 5%',               'GST 5%'),
            ('GST 12%',              'GST 12%'),
            ('GST 0%',               'GST 0%'),
            ('GST @ 18%',            'GST 18%'),
            ('Excempted (GST @ 0%)', 'Exempt'),
            ('GST @ 5% + Cess @ 3%', 'GST 5%')
    )
    SELECT string_agg(format('%s (%s rows)', t.tax_name, t.n), ', ' ORDER BY t.tax_name)
      INTO bad
      FROM (
            SELECT o.tax_name, count(*) AS n
              FROM inventory.item_tax_master o
             WHERE o.tax_name NOT IN (SELECT old_name FROM mapping)
               AND (EXISTS (SELECT 1 FROM inventory.item_master i
                             WHERE i.item_default_tax_id = o.tax_id)
                 OR EXISTS (SELECT 1 FROM inventory.item_tax_history h
                             WHERE h.ith_tax_id = o.tax_id)
                 OR EXISTS (SELECT 1 FROM inventory.item_group_master g
                             WHERE g.itg_default_tax_id = o.tax_id))
             GROUP BY o.tax_name
           ) t;

    IF bad IS NOT NULL THEN
        RAISE EXCEPTION
          'item_tax_master rows still carry data and are not in the mapping: %'
          '  — add them to section 2 of this migration and re-run.', bad;
    END IF;

    WITH mapping(new_name) AS (VALUES
            ('GST 18%'), ('GST 5%'), ('GST 12%'), ('GST 0%'), ('Exempt')
    )
    SELECT string_agg(format('%s -> %s live rows', m.new_name, c.found), ', '
                      ORDER BY m.new_name)
      INTO bad
      FROM mapping m
      CROSS JOIN LATERAL (
            SELECT count(*) AS found
              FROM inventory.tax_rate_master n
             WHERE n.tax_name = m.new_name AND NOT n.tax_is_deleted
           ) c
     WHERE c.found <> 1;

    IF bad IS NOT NULL THEN
        RAISE EXCEPTION
          'every mapping target must resolve to exactly one live tax_rate_master row: %',
          bad;
    END IF;
END $$;

-- ── 4a · Drop the old constraints FIRST ───────────────────────────────────
--  The original psql script repointed the rows and only then swapped the
--  constraints, which cannot work: item_master_item_default_tax_id_fkey still
--  names item_tax_master while section 2 runs, so the very first new id it
--  writes is rejected. Neither FK is DEFERRABLE, so the drop has to come
--  first. Nothing is lost — the ADD in section 4b is what proves the data,
--  and it happens in this same transaction.
ALTER TABLE inventory.item_master
  DROP CONSTRAINT IF EXISTS item_master_item_default_tax_id_fkey;
ALTER TABLE inventory.item_tax_history
  DROP CONSTRAINT IF EXISTS item_tax_history_ith_tax_id_fkey;

-- ── 2 · Repoint the items ─────────────────────────────────────────────────
--  By NAME on both sides, not by pasted uuid: the names are what the mapping
--  above was reviewed against, and a name that stops resolving fails loudly
--  in step 1 rather than updating the wrong rows here.
WITH mapping(old_name, new_name) AS (VALUES
        ('GST 18%','GST 18%'), ('GST 5%','GST 5%'), ('GST 12%','GST 12%'),
        ('GST 0%','GST 0%'),   ('GST @ 18%','GST 18%'),
        ('Excempted (GST @ 0%)','Exempt'), ('GST @ 5% + Cess @ 3%','GST 5%')
),
resolved AS (
    SELECT o.tax_id AS old_id, n.tax_id AS new_id
      FROM mapping m
      JOIN inventory.item_tax_master o ON o.tax_name = m.old_name
      JOIN inventory.tax_rate_master n ON n.tax_name = m.new_name
                                      AND NOT n.tax_is_deleted
)
UPDATE inventory.item_master i
   SET item_default_tax_id = r.new_id
  FROM resolved r
 WHERE i.item_default_tax_id = r.old_id;
-- expect: UPDATE 10034   (10,030 of them on live items; the other 4 are on
--                         deleted items and are carried along by the same
--                         match; 55 items have no tax id at all and are left
--                         alone)

-- ── 2b · Repoint the item GROUPS ──────────────────────────────────────────
--  itg_default_tax_id has no FK, so nothing downstream would ever complain —
--  the group would simply keep offering the item screen an id the item FK
--  refuses. Same mapping, same reasoning.
WITH mapping(old_name, new_name) AS (VALUES
        ('GST 18%','GST 18%'), ('GST 5%','GST 5%'), ('GST 12%','GST 12%'),
        ('GST 0%','GST 0%'),   ('GST @ 18%','GST 18%'),
        ('Excempted (GST @ 0%)','Exempt'), ('GST @ 5% + Cess @ 3%','GST 5%')
),
resolved AS (
    SELECT o.tax_id AS old_id, n.tax_id AS new_id
      FROM mapping m
      JOIN inventory.item_tax_master o ON o.tax_name = m.old_name
      JOIN inventory.tax_rate_master n ON n.tax_name = m.new_name
                                      AND NOT n.tax_is_deleted
)
UPDATE inventory.item_group_master g
   SET itg_default_tax_id = r.new_id
  FROM resolved r
 WHERE g.itg_default_tax_id = r.old_id;
-- expect: UPDATE 30

-- ── 3 · item_tax_history ──────────────────────────────────────────────────
--  Empty today, so there is nothing to move. The same mapping is applied
--  anyway, so that a database which has since grown rows is repointed rather
--  than stopped by the FK in step 4.
WITH mapping(old_name, new_name) AS (VALUES
        ('GST 18%','GST 18%'), ('GST 5%','GST 5%'), ('GST 12%','GST 12%'),
        ('GST 0%','GST 0%'),   ('GST @ 18%','GST 18%'),
        ('Excempted (GST @ 0%)','Exempt'), ('GST @ 5% + Cess @ 3%','GST 5%')
),
resolved AS (
    SELECT o.tax_id AS old_id, n.tax_id AS new_id
      FROM mapping m
      JOIN inventory.item_tax_master o ON o.tax_name = m.old_name
      JOIN inventory.tax_rate_master n ON n.tax_name = m.new_name
                                      AND NOT n.tax_is_deleted
)
UPDATE inventory.item_tax_history h
   SET ith_tax_id = r.new_id
  FROM resolved r
 WHERE h.ith_tax_id = r.old_id;
-- expect: UPDATE 0

-- ── 4b · Add the new constraints (§4c of 20_tax_rate_master.sql) ──────────
--  These REFUSE to be added while any row still names the old table, which is
--  the real verification of steps 2 and 3 — do not weaken them to NOT VALID.
--  Both are added inside the same transaction that dropped the old pair, so
--  item_default_tax_id is never left unconstrained to any concurrent writer.
ALTER TABLE inventory.item_master
  ADD  CONSTRAINT item_master_item_default_tax_id_fkey
       FOREIGN KEY (item_default_tax_id)
       REFERENCES inventory.tax_rate_master (tax_id)
       ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE inventory.item_tax_history
  ADD  CONSTRAINT item_tax_history_ith_tax_id_fkey
       FOREIGN KEY (ith_tax_id)
       REFERENCES inventory.tax_rate_master (tax_id)
       ON UPDATE CASCADE ON DELETE RESTRICT;

-- ── 5 · Verify before committing ──────────────────────────────────────────
--  The FK in section 4 already proves every item is on SOME row of the new
--  master. What it cannot prove is that the row is live, or that the groups
--  of section 2b (which have no FK) came along — so both are checked here,
--  and the resulting spread is reported as a NOTICE for the deploy log.
DO $$
DECLARE
    stranded int;
    r        record;
BEGIN
    SELECT count(*) INTO stranded
      FROM inventory.item_master i
      JOIN inventory.tax_rate_master n ON n.tax_id = i.item_default_tax_id
     WHERE NOT i.item_is_deleted AND n.tax_is_deleted;
    IF stranded > 0 THEN
        RAISE EXCEPTION '% live items now sit on a DELETED tax rate', stranded;
    END IF;

    SELECT count(*) INTO stranded
      FROM inventory.item_group_master g
     WHERE g.itg_default_tax_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM inventory.tax_rate_master n
                        WHERE n.tax_id = g.itg_default_tax_id
                          AND NOT n.tax_is_deleted);
    IF stranded > 0 THEN
        RAISE EXCEPTION
          '% item groups still point outside the live tax_rate_master', stranded;
    END IF;

    FOR r IN
        SELECT coalesce(n.tax_name, '(no tax)') AS new_name,
               n.tax_rate_perc, count(*) AS items
          FROM inventory.item_master i
          LEFT JOIN inventory.tax_rate_master n ON n.tax_id = i.item_default_tax_id
         WHERE NOT i.item_is_deleted
         GROUP BY 1, 2 ORDER BY items DESC
    LOOP
        RAISE NOTICE 'items on % (rate %): % items', r.new_name, r.tax_rate_perc, r.items;
    END LOOP;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
--  6 · AFTERWARDS
--
--  a) The CLIENT SWITCH is then safe and is three changes, all small:
--       · dropdown 36 (TAXES) — repoint its SQL at the new master:
--             SELECT tax_id, tax_name, tax_rate_perc, tax_taxability
--               FROM inventory.tax_rate_master
--              WHERE tax_is_active AND NOT tax_is_deleted
--              ORDER BY tax_sort_order, tax_name
--         (dropdown 53 already reads this table and can be copied; it differs
--          only in offering deleted-but-not-active rows for Supersedes)
--       · ItemPriceGridController::fetchItemTax() — /item-taxes/get becomes
--         /tax-rates/get, and the three fields it reads change name:
--             tax_gst_rate_total -> tax_rate_perc
--             tax_cess_perc      -> tax_cess_perc      (unchanged)
--             tax_cess_unit      -> tax_cess_per_unit
--         There is also a SECOND cess now (tax_acess_perc / tax_acess_per_unit,
--         the state cess) which the price grid does not yet account for.
--       · anything else still calling /item-taxes/*.
--
--  b) inventory.item_tax_master can then be dropped. Leave it until the
--     client release that stops reading it is actually deployed — a desktop
--     install does not update everywhere at once.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
--  7 · THE CLIENT SIDE, AND THE ORDER IT HAS TO HAPPEN IN
--
--  Done already (2026-09-12), because it degrades safely on its own:
--    · ItemPriceGridController::fetchItemTax() now calls /tax-rates/get and
--      reads tax_rate_perc / tax_cess_per_unit, folding the state cess into
--      the same two accumulators. Its failure path is now a qWarning, not a
--      modal — so while the items still carry old ids it simply cannot split
--      cost-with-tax, rather than throwing a dialog in the operator's face on
--      every item they open.
--
--  NOT done, and deliberately LAST — it is the one step that breaks saving:
--    · dropdown 36 (TAXES) repointed at this table. The payload is ready at
--      grids/dropdown_36_taxes_to_rate_master.json:
--
--        curl -sk -X POST "$BASE/dropdown-details/create" \
--             -H "Authorization: Bearer $TOKEN" \
--             -H 'Content-Type: application/json' \
--             --data-binary @grids/dropdown_36_taxes_to_rate_master.json
--
--      Run it only AFTER this migration. Flip it first and the item entry
--      offers rates whose ids the FK still refuses, so every item save that
--      touches the tax field fails — and dropdown 36 is server config, so
--      that lands on everyone using this server at once, not just one build.
-- ═══════════════════════════════════════════════════════════════════════════
