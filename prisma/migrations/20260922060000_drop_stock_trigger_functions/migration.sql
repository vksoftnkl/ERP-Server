-- ═══════════════════════════════════════════════════════════════════════════
--  Take the remaining LOGIC out of the deployed `stock` schema.
--
--  ── What was actually deployed ──────────────────────────────────────────
--  The stock schema files declare 33 functions and triggers between them. The
--  live database held FOUR functions and three triggers (each trigger on the
--  partitioned parent plus its four partitions — 15 instances):
--
--      fn_create_stock_partitions   DDL — KEPT, see §3
--      fn_sml_immutable             + tr_sml_immutable
--      fn_sml_forbid_delete         + tr_sml_forbid_delete
--      fn_sml_freeze_guard          + tr_sml_freeze_guard
--
--  Everything else — fn_svh_post, fn_svh_cancel, fn_sml_apply, every refresh
--  and every resolver — was NEVER DEPLOYED. NestJS reimplemented that engine
--  and the .sql drifted into being a spec nobody runs.
--
--  fn_sml_forbid_delete is live and appears in NO FILE in this repository.
--  Someone added it by hand. That alone is the argument for this file.
--
--  ── WHAT THE SERVICE MUST NOW DO, because the database no longer will ───
--
--  These three guards were doing real work. Dropping them moves that work to
--  StockPostingService, and NOTHING enforces it until that is built. Written
--  here because this migration is where the net was removed.
--
--   1. THE FREEZE. tr_sml_freeze_guard refused a stock_ledger insert while a
--      godown was frozen for a physical count. It tested the WALL CLOCK:
--
--          now() BETWEEN svh_freeze_from AND svh_freeze_to
--
--      Two readings of that, and they disagree — which is worth recording,
--      because whoever writes the replacement has to pick one:
--
--        * the design note calls it a bug. now() is when the row ARRIVES, not
--          when the goods moved. A sale made at 10:00, before the count began,
--          that SYNCS at 14:00 while it is running, is refused — although the
--          shelf was already short when the counter started. On an offline
--          chain that is not a corner case.
--        * src/modules/stocks/stock-voucher/types/stock-voucher.types.ts
--          documents it as DELIBERATE: "WALL CLOCK, NOT DOCUMENT DATE ... a
--          back-dated entry still changes today's shelf."
--
--      The note's replacement compares the MOVEMENT's own sml_doc_datetime to
--      the window: a movement that HAPPENED before the freeze is admitted and
--      flagged for the count to reconcile; only one that happened DURING it is
--      refused. The count's own rows pass either way (svh_id matches
--      sml_src_doc_id). NOTE: there are live freeze configurations on
--      stock_voucher, so until the service check exists a count can be posted
--      against a moving shelf.
--
--   2. APPEND-ONLY. tr_sml_immutable and tr_sml_forbid_delete were the only
--      thing standing between a service bug and rewritten stock history. They
--      never broke the offline push — a sync only INSERTs.
--
--      As checked when this ran, the code IS append-only in practice: two
--      INSERT sites, both raw SQL in
--      src/modules/stocks/stock-voucher/stock-voucher-posting.helper.ts, and
--      no UPDATE or DELETE against stock.stock_ledger anywhere in src/. What
--      does NOT yet exist is the STRUCTURAL guarantee: one repository method
--      that writes the table, only ever INSERTing, with a test asserting no
--      other path touches it. A correction must be a REVERSING ROW.
--      A convention will not do — that is what these triggers were protecting
--      against, and it is now the service's job alone.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. The freeze guard ──────────────────────────────────────────────────
DROP TRIGGER  IF EXISTS tr_sml_freeze_guard ON stock.stock_ledger;
DROP FUNCTION IF EXISTS stock.fn_sml_freeze_guard();

-- ── 2. The append-only guards ────────────────────────────────────────────
DROP TRIGGER  IF EXISTS tr_sml_immutable ON stock.stock_ledger;
DROP FUNCTION IF EXISTS stock.fn_sml_immutable();

DROP TRIGGER  IF EXISTS tr_sml_forbid_delete ON stock.stock_ledger;
-- The same function also backs a BEFORE TRUNCATE trigger on the live box.
-- It must go first: DROP FUNCTION is refused while any trigger depends on it.
DROP TRIGGER  IF EXISTS tr_sml_forbid_truncate ON stock.stock_ledger;
DROP FUNCTION IF EXISTS stock.fn_sml_forbid_delete();


-- ═══════════════════════════════════════════════════════════════════════════
--  §3. fn_create_stock_partitions — RECONCILED, NOT DROPPED.
--
--  The design note's §3 drops this function so that a re-run of
--  schema/stock/16_stock.sql can re-create it as RETURNS integer, reconciling
--  a return-type drift (the deployed copy is RETURNS void, so re-running 16
--  fails with "cannot change return type of existing function").
--
--  THAT SEQUENCE CANNOT BE FOLLOWED HERE, and a bare drop would break things:
--
--    * 16_stock.sql is NOT in this repository, so nothing could re-create the
--      function after the drop;
--    * public.ensure_acc_year_partitions PERFORMs it — that is the helper the
--      application calls by name (receipt.guards.ts tells an operator to run
--      it) and the only one that reaches the four stock.* partitioned tables.
--      Dropping the function makes every fiscal-year roll fail.
--
--  So instead of dropping it, this reconciles the return type IN PLACE and
--  keeps the function: the body below is the DEPLOYED body, preserved
--  verbatim, with a counter added so it can return integer. That achieves
--  what §3 was for — a later run of 16_stock.sql now succeeds instead of
--  failing on the return type — without a window in which the function does
--  not exist.
--
--  The integer wrapper is authored here, not copied from 16. If 16's body
--  differs, its CREATE OR REPLACE will simply overwrite this one, which is
--  exactly what §3 wanted to make possible.
--
--  PERFORM ignores a return value, so ensure_acc_year_partitions is unaffected.
-- ═══════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS stock.fn_create_stock_partitions(character);

CREATE OR REPLACE FUNCTION stock.fn_create_stock_partitions(p_acc_year character)
RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE
    v_year   text := btrim(p_acc_year);
    v_suffix text;
    v_count  integer := 0;
BEGIN
    -- The partition bound is a literal, so the year is validated rather than
    -- interpolated blind. char(9) makes 'YYYY-YYYY' the only well-formed value.
    IF v_year !~ '^[0-9]{4}-[0-9]{4}$' THEN
        RAISE EXCEPTION 'Invalid accounting year %, expected YYYY-YYYY', p_acc_year;
    END IF;

    v_suffix := replace(v_year, '-', '_');

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS stock.%I PARTITION OF stock.stock_voucher FOR VALUES IN (%L)',
        'stock_voucher_' || v_suffix, v_year);
    v_count := v_count + 1;

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS stock.%I PARTITION OF stock.stock_voucher_item FOR VALUES IN (%L)',
        'stock_voucher_item_' || v_suffix, v_year);
    v_count := v_count + 1;

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS stock.%I PARTITION OF stock.stock_ledger FOR VALUES IN (%L)',
        'stock_ledger_' || v_suffix, v_year);
    v_count := v_count + 1;

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS stock.%I PARTITION OF stock.stock_reservation FOR VALUES IN (%L)',
        'stock_reservation_' || v_suffix, v_year);
    v_count := v_count + 1;

    RETURN v_count;   -- number of stock parents visited
END;
$function$;

ALTER FUNCTION stock.fn_create_stock_partitions(character) OWNER TO postgres;


-- ── 4. Assert the end state ──────────────────────────────────────────────
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
        RAISE EXCEPTION 'expected only fn_create_stock_partitions to remain, got: %', v_fns;
    END IF;
    IF v_trgs <> 'NONE' THEN
        RAISE EXCEPTION 'expected no triggers left in schema stock, got: %', v_trgs;
    END IF;

    -- The kept function must still answer, and with the reconciled type.
    IF (SELECT pg_get_function_result(p.oid) FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname='stock' AND p.proname='fn_create_stock_partitions') <> 'integer' THEN
        RAISE EXCEPTION 'fn_create_stock_partitions did not come back as RETURNS integer';
    END IF;

    RAISE NOTICE 'stock schema: functions = %, triggers = %', v_fns, v_trgs;
END
$verify$;
