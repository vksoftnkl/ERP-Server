-- ═══════════════════════════════════════════════════════════════════════════
--  Finish what 20260922060000 started: NO functions and NO triggers on
--  stock.stock_ledger.
--
--  ── Why a second migration ───────────────────────────────────────────────
--  20260922060000 is recorded as applied on the dev box (192.168.0.106), yet
--  the box still carried
--
--      stock.fn_sml_immutable      + tr_sml_immutable
--      stock.fn_sml_forbid_delete  + tr_sml_forbid_delete
--                                  + tr_sml_forbid_truncate   ← in no file here
--
--  on 2026-09-21 evening. Whether the guards were re-created by hand after the
--  migration ran or the migration was marked applied without running, the
--  result is the same: the database disagrees with the migration history, and
--  the rule "no functions, no triggers" — plan A2, rule 1 — is not true of it.
--
--  tr_sml_forbid_truncate is also why 060000 CANNOT succeed on a database
--  that has it: `DROP FUNCTION stock.fn_sml_forbid_delete()` is refused while
--  that trigger still depends on the function. 060000 now drops the trigger
--  too; this file is the idempotent sweep that repairs a database that
--  already got past it.
--
--  ── What replaces them ──────────────────────────────────────────────────
--  The till posts OFFLINE and pushes to the cloud on reconnect; a trigger
--  fires on the SERVER during that push, on rows written hours earlier. So
--  the guarantee is structural, in the service, and asserted by tests:
--
--   * ONE insert site — stock-voucher-posting.helper.ts, run only through
--     StockPostingService — and no UPDATE, DELETE or TRUNCATE of the table
--     anywhere in src/: test/stock-ledger-single-writer.e2e-spec.ts walks the
--     source and fails on the first offender.
--   * A correction is a REVERSING ROW (StockPostingService.cancel), never an
--     edit: test/stock-engine-ts.e2e-spec.ts case 8.
--   * The freeze is StockPostingService.assertNotFrozen, on the movement's
--     own sml_doc_datetime rather than now(): case 6 of the same suite.
--
--  Every statement is IF EXISTS, so a database 060000 already cleaned passes
--  through unchanged. fn_create_stock_partitions is the one function that
--  stays: DDL, called by public.ensure_acc_year_partitions at year roll.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Triggers on the partitioned parent. Partition copies are dependent
--       objects and go with them. ─────────────────────────────────────────
DROP TRIGGER IF EXISTS tr_sml_forbid_truncate ON stock.stock_ledger;
DROP TRIGGER IF EXISTS tr_sml_forbid_delete   ON stock.stock_ledger;
DROP TRIGGER IF EXISTS tr_sml_immutable       ON stock.stock_ledger;
DROP TRIGGER IF EXISTS tr_sml_freeze_guard    ON stock.stock_ledger;

-- ── 2. Anything hand-attached to a partition directly (not cloned from the
--       parent), which the four drops above would not reach. ──────────────
DO $sweep$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT t.tgname, c.oid::regclass AS tbl
          FROM pg_trigger t
          JOIN pg_class c ON c.oid = t.tgrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'stock'
           AND NOT t.tgisinternal
           AND t.tgparentid = 0          -- clones cannot be dropped alone
           AND t.tgname IN ('tr_sml_forbid_truncate', 'tr_sml_forbid_delete',
                            'tr_sml_immutable', 'tr_sml_freeze_guard')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', r.tgname, r.tbl);
    END LOOP;
END
$sweep$;

-- ── 3. The functions, now that nothing depends on them. ──────────────────
DROP FUNCTION IF EXISTS stock.fn_sml_forbid_delete();
DROP FUNCTION IF EXISTS stock.fn_sml_immutable();
DROP FUNCTION IF EXISTS stock.fn_sml_freeze_guard();

-- ── 4. Assert the end state, exactly as 060000 does. ─────────────────────
DO $verify$
DECLARE
    v_fns  text;
    v_trgs text;
BEGIN
    SELECT coalesce(string_agg(p.proname, ', ' ORDER BY p.proname), 'NONE') INTO v_fns
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'stock';

    SELECT coalesce(string_agg(DISTINCT t.tgname, ', '), 'NONE') INTO v_trgs
      FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'stock' AND NOT t.tgisinternal;

    IF v_fns <> 'fn_create_stock_partitions' THEN
        RAISE EXCEPTION 'expected only fn_create_stock_partitions to remain in schema stock, got: %', v_fns;
    END IF;
    IF v_trgs <> 'NONE' THEN
        RAISE EXCEPTION 'expected no triggers left in schema stock, got: %', v_trgs;
    END IF;

    RAISE NOTICE 'stock schema: functions = %, triggers = %', v_fns, v_trgs;
END
$verify$;
