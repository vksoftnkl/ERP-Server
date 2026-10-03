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
--    · /tax-rates/get answers 404 for every id the existing items carry, so
--      merely OPENING an item would raise an error.
--
--  ── HOW AN OLD ROW IS MATCHED TO A NEW ONE ──────────────────────────────
--  In two passes, section 1a then 1b, and a row is only ever mapped once:
--
--   1a BY NAME, from the reviewed table below. These are the judgement calls
--      — the two cess-bearing rows in particular (see below) — and they are
--      settled here rather than derived, so that they can be read and argued
--      with. A name that no longer resolves simply matches nothing and falls
--      through to 1b; it cannot silently move rows to the wrong rate.
--
--   1b BY TAXABILITY AND RATE, for anything 1a did not cover: an old row is
--      matched to the single live tax_rate_master row with the same
--      tax_taxability and the same total rate. This is the same equivalence
--      the named mapping expresses, just computed, and it is what lets this
--      migration run on a database whose operators typed their own names into
--      the old master. Rows carrying cess are excluded from 1b on purpose —
--      dropping a cess is a decision, so it belongs in 1a by name.
--
--   1c Then: every old row that CARRIES DATA must have come out of 1a or 1b.
--      Unmatched, ambiguous or cess-bearing leftovers abort the migration
--      with the row named, before anything has been written.
--
--  ── WHAT THE DATA LOOKED LIKE ON 192.168.0.106, 2026-09-12 ──────────────
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
--  ── AND ON THE VPS (169.58.213.171), WHICH IS WHY 1b EXISTS ─────────────
--  That server was seeded separately and its old master holds two rows of its
--  own, neither of which appears in the named mapping above:
--
--      old row                    items   ->  new row      matched by
--      ─────────────────────────────────────────────────────────────────
--      Exempted    EXEMPT 0%         12   ->  Exempt       1b
--      test        EXEMPT 0%          1   ->  Exempt       1b
--
--  Both are EXEMPT at 0% with no cess, so 'Exempt' is the only live row they
--  can mean and no rate or cess information is lost. Before 1b existed this
--  migration aborted here on every deploy (P3009, 2026-09-12) — correctly,
--  since a hardcoded list of one database's names is not a mapping.
--
--  ── NINETEEN ITEMS CARRY CESS; THE CESS IS DROPPED ──────────────────────
--  tax_rate_master has no cess-bearing row — the seeded slabs are the seven
--  statutory rates plus the four non-taxable kinds. Nineteen items sit on two
--  old rows that do carry cess ('GST @ 18%' with 5 per unit, 'GST @ 5% + Cess
--  @ 3%'), and 1a maps them to the plain rate and drops the cess.
--
--  Confirmed with the user 2026-09-12: the existing figures are test data, not
--  a tax position, so there is nothing to preserve. It shows in the rows —
--  chilli powder, turmeric, biscuits, a matchbox, aspirin, and eight plainly
--  typed to exercise the screen ('fdfdff', 'undskndk', 'thursday'). None of
--  them attracts compensation cess in law, which is for tobacco, aerated
--  drinks, coal and motor vehicles.
--
--  If a real cess-bearing item ever needs one: create the rate on the GST Rate
--  screen first, then name it in the 1a mapping. Nothing will slip through in
--  the meantime — 1b refuses cess-bearing rows, and 1c then names them.
--
--  ── FOUR CHANGES MADE WHEN THIS BECAME A PRISMA MIGRATION (2026-09-12) ───
--  a) Sections 1 and 5 were bare SELECTs, written to be eyeballed in psql. A
--     migration has nobody reading its output, so the checks RAISE EXCEPTION
--     instead: an old row with items on it that cannot be matched now aborts
--     the migration rather than scrolling past. Section 5 reports its tallies
--     as NOTICEs.
--  b) Section 2b was added. inventory.item_group_master.itg_default_tax_id
--     holds the same old ids on 30 groups and has NO foreign key, so section 4
--     cannot catch it — the group default would keep handing the item screen
--     ids the FK refuses. All 30 sit on GST 18/5/12/0%, already in 1a, and no
--     cess is involved.
--  c) The constraint swap was split in two. Section 4a drops the old pair
--     BEFORE the updates — as written, the FK to item_tax_master was still in
--     force while section 2 wrote tax_rate_master ids, so the first row was
--     rejected and the script could never have run to the end. Section 4b adds
--     the new pair after, in the same transaction, and is still what proves
--     the data. DROP also gained IF EXISTS so a database already repointed by
--     hand does not halt here.
--  d) The mapping was resolved ONCE into the tax_id_map temp table, instead of
--     the same seven-row VALUES list being repeated in each of sections 2, 2b
--     and 3. Three copies of a mapping is three chances for them to disagree,
--     and section 1 could only ever have vouched for its own copy.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1 · Resolve old id -> new id, and prove it, BEFORE touching a row ─────
CREATE TEMP TABLE tax_id_map (
    old_id   uuid PRIMARY KEY,
    new_id   uuid NOT NULL,
    matched  text NOT NULL
) ON COMMIT DROP;

-- ── 1a · By name: the reviewed decisions ──────────────────────────────────
--  By NAME on both sides, not by pasted uuid: the names are what this mapping
--  was reviewed against, and the ids differ per database anyway.
INSERT INTO tax_id_map (old_id, new_id, matched)
SELECT o.tax_id, n.tax_id, format('name %L -> %L', o.tax_name, n.tax_name)
  FROM (VALUES
        ('GST 18%',              'GST 18%'),
        ('GST 5%',               'GST 5%'),
        ('GST 12%',              'GST 12%'),
        ('GST 0%',               'GST 0%'),
        ('GST @ 18%',            'GST 18%'),
        ('Excempted (GST @ 0%)', 'Exempt'),
        ('GST @ 5% + Cess @ 3%', 'GST 5%')
       ) AS m(old_name, new_name)
  JOIN inventory.item_tax_master o ON o.tax_name = m.old_name
  JOIN inventory.tax_rate_master n ON n.tax_name = m.new_name
                                  AND NOT n.tax_is_deleted;

-- ── 1b · By taxability and rate: everything else ──────────────────────────
--  Only where exactly ONE live rate can be meant. Ambiguity is left for 1c to
--  report by name rather than resolved by luck of the sort order.
INSERT INTO tax_id_map (old_id, new_id, matched)
SELECT o.tax_id, c.tax_id,
       format('rate %s @ %s%% -> %L', o.tax_taxability_type,
              o.tax_gst_rate_total, c.tax_name)
  FROM inventory.item_tax_master o
  JOIN LATERAL (
        SELECT n.tax_id, n.tax_name, count(*) OVER () AS candidates
          FROM inventory.tax_rate_master n
         WHERE NOT n.tax_is_deleted
           AND n.tax_taxability  = upper(btrim(o.tax_taxability_type))
           AND n.tax_rate_perc   = o.tax_gst_rate_total
       ) c ON c.candidates = 1
 WHERE NOT EXISTS (SELECT 1 FROM tax_id_map t WHERE t.old_id = o.tax_id)
   AND o.tax_cess_perc     = 0 AND o.tax_cess_unit     = 0
   AND o.tax_cess_pur_perc = 0 AND o.tax_cess_pur_unit = 0;

-- ── 1c · Anything that carries data and did not match: stop ───────────────
--  Caught here: an old tax row with items, groups or history on it that 1a
--  does not name and 1b cannot resolve. The message says which of the three
--  reasons it was, because the remedy differs — a cess-bearing row needs a
--  decision in 1a, an ambiguous one needs the duplicate rates cleaned up on
--  the GST Rate screen, and a missing one needs the rate created.
DO $$
DECLARE
    bad text;
BEGIN
    SELECT string_agg(
               format('%L (%s items, %s groups, %s history; %s @ %s%%): %s',
                      t.tax_name, t.items, t.groups, t.history,
                      t.tax_taxability_type, t.tax_gst_rate_total, t.reason),
               E'\n  ' ORDER BY t.tax_name)
      INTO bad
      FROM (
            SELECT o.tax_name, o.tax_taxability_type, o.tax_gst_rate_total,
                   (SELECT count(*) FROM inventory.item_master i
                     WHERE i.item_default_tax_id = o.tax_id)        AS items,
                   (SELECT count(*) FROM inventory.item_group_master g
                     WHERE g.itg_default_tax_id = o.tax_id)         AS groups,
                   (SELECT count(*) FROM inventory.item_tax_history h
                     WHERE h.ith_tax_id = o.tax_id)                 AS history,
                   CASE
                     WHEN o.tax_cess_perc > 0 OR o.tax_cess_unit > 0
                       OR o.tax_cess_pur_perc > 0 OR o.tax_cess_pur_unit > 0
                       THEN 'carries cess, so needs a decision by name in section 1a'
                     WHEN (SELECT count(*) FROM inventory.tax_rate_master n
                            WHERE NOT n.tax_is_deleted
                              AND n.tax_taxability = upper(btrim(o.tax_taxability_type))
                              AND n.tax_rate_perc  = o.tax_gst_rate_total) > 1
                       THEN 'more than one live tax_rate_master row has this taxability and rate'
                     ELSE 'no live tax_rate_master row has this taxability and rate'
                   END AS reason
              FROM inventory.item_tax_master o
             WHERE NOT EXISTS (SELECT 1 FROM tax_id_map t WHERE t.old_id = o.tax_id)
               AND (EXISTS (SELECT 1 FROM inventory.item_master i
                             WHERE i.item_default_tax_id = o.tax_id)
                 OR EXISTS (SELECT 1 FROM inventory.item_tax_history h
                             WHERE h.ith_tax_id = o.tax_id)
                 OR EXISTS (SELECT 1 FROM inventory.item_group_master g
                             WHERE g.itg_default_tax_id = o.tax_id))
           ) t;

    IF bad IS NOT NULL THEN
        RAISE EXCEPTION E'item_tax_master rows still carry data and cannot be mapped onto tax_rate_master:\n  %', bad;
    END IF;

    FOR bad IN SELECT matched FROM tax_id_map ORDER BY matched LOOP
        RAISE NOTICE 'mapping: %', bad;
    END LOOP;
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
UPDATE inventory.item_master i
   SET item_default_tax_id = m.new_id
  FROM tax_id_map m
 WHERE i.item_default_tax_id = m.old_id;
-- expect: 192.168.0.106 -> UPDATE 10034   (10,030 of them on live items; the
--                         other 4 are on deleted items and are carried along
--                         by the same match; 55 items have no tax id at all
--                         and are left alone)
--         169.58.213.171 -> UPDATE 13

-- ── 2b · Repoint the item GROUPS ──────────────────────────────────────────
--  itg_default_tax_id has no FK, so nothing downstream would ever complain —
--  the group would simply keep offering the item screen an id the item FK
--  refuses. Same map, same reasoning.
UPDATE inventory.item_group_master g
   SET itg_default_tax_id = m.new_id
  FROM tax_id_map m
 WHERE g.itg_default_tax_id = m.old_id;
-- expect: 192.168.0.106 -> UPDATE 30      169.58.213.171 -> UPDATE 0

-- ── 3 · item_tax_history ──────────────────────────────────────────────────
--  Empty on both databases today, so there is nothing to move. The same map
--  is applied anyway, so that a database which has since grown rows is
--  repointed rather than stopped by the FK in section 4b.
UPDATE inventory.item_tax_history h
   SET ith_tax_id = m.new_id
  FROM tax_id_map m
 WHERE h.ith_tax_id = m.old_id;
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
--  The FK in section 4b already proves every item is on SOME row of the new
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
