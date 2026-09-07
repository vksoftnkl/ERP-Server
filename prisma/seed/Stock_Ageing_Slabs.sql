-- Seed: stock.stock_ageing_slab -- the DEFAULT ageing ladder (5 rows).
--
-- sag_company_id NULL, so every company that has not defined its own ladder gets
-- these. A company that wants a dairy's 0-3-7 inserts its own FULL ladder and
-- fn_sag_effective stops offering these -- all or nothing, never mixed. That is
-- why the guard below is on "any shared slab exists", not on the slab number:
-- half a ladder is worse than none, so a partially-deleted default is left alone
-- rather than silently topped back up.
--
-- The last slab's sag_to_days is NULL: open-ended, "and everything older".
--
-- sag_id (uuidv7) is deliberately NOT written out: nothing outside this database
-- refers to it, so each environment generates its own. The stable identity is
-- (sag_company_id, sag_slab_no).
--
-- Guarded on to_regclass so the file is a clean no-op -- not a deploy error --
-- on a database where the stock movement engine has not been migrated in yet.
-- Run: psql "$DATABASE_URL" -f prisma/seed/Stock_Ageing_Slabs.sql
--      or: npm run seed:run -- --only=Stock_Ageing_Slabs.sql

BEGIN;

DO $do$
BEGIN
    IF to_regclass('stock.stock_ageing_slab') IS NULL THEN
        RAISE NOTICE 'stock.stock_ageing_slab does not exist yet -- skipping Stock_Ageing_Slabs.sql.';
        RETURN;
    END IF;

    EXECUTE $sql$
INSERT INTO stock.stock_ageing_slab
    (sag_company_id, sag_slab_no, sag_label, sag_from_days, sag_to_days)
SELECT NULL::uuid, v.no, v.label, v.from_days, v.to_days
  FROM (VALUES
    (1, '0-30 days'::varchar,     0,   30),
    (2, '31-60 days',            31,   60),
    (3, '61-90 days',            61,   90),
    (4, '91-180 days',           91,  180),
    (5, 'Over 180 days',        181, NULL)
  ) AS v(no, label, from_days, to_days)
 WHERE NOT EXISTS (
        SELECT 1
          FROM stock.stock_ageing_slab e
         WHERE e.sag_company_id IS NULL
           AND e.sag_is_deleted = false)
    $sql$;
END
$do$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
--  What is deliberately NOT seeded: stock.stock_track_policy.
--
--  There is no sensible default. A company-wide "track nothing" row would look
--  identical to having no row at all, except that it would then WIN over a
--  group-scope row somebody adds later and quietly un-track a whole group.
--  fn_stp_effective already falls back to track-nothing when it finds no row,
--  which is the same answer with none of the risk. Leave the table empty until
--  somebody tracks something. (The tracking PRESETS -- the stencils the policy
--  screen offers -- are a different table and are seeded, in
--  prisma/seed/Stock_Track_Presets.sql.)
-- ═══════════════════════════════════════════════════════════════════════════

-- Verification, safe to run any time:
--   SELECT * FROM stock.fn_sag_effective(:any_company_id);
